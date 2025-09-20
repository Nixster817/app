from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Form
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import shutil
from PIL import Image
import io
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Create uploads directory
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Mount static files for image serving
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Define Models
class Marketplace(BaseModel):
    id: str
    name: str
    description: str
    logo_url: str
    is_active: bool
    requires_auth: bool
    auth_status: str = "disconnected"  # connected, disconnected, expired

class MarketplacePosting(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    listing_id: str
    marketplace_id: str
    marketplace_listing_id: Optional[str] = None
    status: str = "pending"  # pending, posted, failed, expired
    posted_at: Optional[datetime] = None
    error_message: Optional[str] = None
    listing_url: Optional[str] = None

class Listing(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    condition: str  # new, like_new, slightly_used, used, non_working
    price: float
    images: List[str] = []  # Array of image URLs
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    marketplace_postings: List[MarketplacePosting] = []

class ListingCreate(BaseModel):
    title: str
    description: str
    condition: str
    price: float

class ListingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    condition: Optional[str] = None
    price: Optional[float] = None

# Helper function to prepare data for MongoDB
def prepare_for_mongo(data):
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, datetime):
                data[key] = value.isoformat()
    return data

# Helper function to parse data from MongoDB
def parse_from_mongo(item):
    if isinstance(item.get('created_at'), str):
        item['created_at'] = datetime.fromisoformat(item['created_at'])
    if isinstance(item.get('updated_at'), str):
        item['updated_at'] = datetime.fromisoformat(item['updated_at'])
    return item

# Routes
@api_router.get("/")
async def root():
    return {"message": "Multi-Marketplace Seller API"}

@api_router.post("/listings", response_model=Listing)
async def create_listing(listing: ListingCreate):
    listing_dict = listing.dict()
    listing_obj = Listing(**listing_dict)
    
    # Prepare for MongoDB storage
    mongo_data = prepare_for_mongo(listing_obj.dict())
    result = await db.listings.insert_one(mongo_data)
    
    return listing_obj

@api_router.get("/listings", response_model=List[Listing])
async def get_listings():
    listings = await db.listings.find().sort("created_at", -1).to_list(100)
    parsed_listings = [parse_from_mongo(listing) for listing in listings]
    return [Listing(**listing) for listing in parsed_listings]

@api_router.get("/listings/{listing_id}", response_model=Listing)
async def get_listing(listing_id: str):
    listing = await db.listings.find_one({"id": listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    parsed_listing = parse_from_mongo(listing)
    return Listing(**parsed_listing)

@api_router.put("/listings/{listing_id}", response_model=Listing)
async def update_listing(listing_id: str, update_data: ListingUpdate):
    # Find existing listing
    existing_listing = await db.listings.find_one({"id": listing_id})
    if not existing_listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    # Update fields
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc)
    
    # Prepare for MongoDB
    update_dict = prepare_for_mongo(update_dict)
    
    # Update in database
    await db.listings.update_one(
        {"id": listing_id},
        {"$set": update_dict}
    )
    
    # Return updated listing
    updated_listing = await db.listings.find_one({"id": listing_id})
    parsed_listing = parse_from_mongo(updated_listing)
    return Listing(**parsed_listing)

@api_router.delete("/listings/{listing_id}")
async def delete_listing(listing_id: str):
    result = await db.listings.delete_one({"id": listing_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Listing not found")
    return {"message": "Listing deleted successfully"}

@api_router.post("/listings/{listing_id}/images")
async def upload_listing_image(listing_id: str, file: UploadFile = File(...)):
    # Validate file type
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Generate unique filename
    file_extension = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    file_path = UPLOAD_DIR / unique_filename
    
    # Save file
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Optionally resize image for optimization
        with Image.open(file_path) as img:
            # Resize if image is too large
            max_size = (1200, 1200)
            if img.size[0] > max_size[0] or img.size[1] > max_size[1]:
                img.thumbnail(max_size, Image.Resampling.LANCZOS)
                img.save(file_path, optimize=True, quality=85)
        
        # Update listing with image URL
        image_url = f"/uploads/{unique_filename}"
        
        await db.listings.update_one(
            {"id": listing_id},
            {"$push": {"images": image_url}}
        )
        
        return {"image_url": image_url, "message": "Image uploaded successfully"}
        
    except Exception as e:
        # Clean up file if something went wrong
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {str(e)}")

@api_router.delete("/listings/{listing_id}/images")
async def remove_listing_image(listing_id: str, image_url: str = Form(...)):
    # Remove from database
    result = await db.listings.update_one(
        {"id": listing_id},
        {"$pull": {"images": image_url}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Listing or image not found")
    
    # Remove physical file
    try:
        filename = image_url.split('/')[-1]
        file_path = UPLOAD_DIR / filename
        if file_path.exists():
            file_path.unlink()
    except Exception as e:
        logger.warning(f"Failed to delete physical file {image_url}: {str(e)}")
    
    return {"message": "Image removed successfully"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()