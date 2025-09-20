import React, { useState, useEffect } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Textarea } from "./components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { Badge } from "./components/ui/badge";
import { Checkbox } from "./components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./components/ui/dialog";
import { Progress } from "./components/ui/progress";
import { Separator } from "./components/ui/separator";
import { Trash2, Upload, Eye, Plus, Package, Tag, DollarSign, Share2, CheckCircle, XCircle, Clock, ExternalLink, Settings } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "./components/ui/sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Multi-Marketplace Posting Dialog Component
const MarketplacePostingDialog = ({ listing, onPostingComplete }) => {
  const [open, setOpen] = useState(false);
  const [marketplaces, setMarketplaces] = useState([]);
  const [selectedMarketplaces, setSelectedMarketplaces] = useState([]);
  const [posting, setPosting] = useState(false);
  const [postingResults, setPostingResults] = useState(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (open) {
      fetchMarketplaces();
    }
  }, [open]);

  const fetchMarketplaces = async () => {
    try {
      const response = await axios.get(`${API}/marketplaces`);
      setMarketplaces(response.data);
    } catch (error) {
      console.error('Error fetching marketplaces:', error);
      toast.error("Failed to load marketplaces");
    }
  };

  const handleMarketplaceToggle = (marketplaceId) => {
    setSelectedMarketplaces(prev => 
      prev.includes(marketplaceId)
        ? prev.filter(id => id !== marketplaceId)
        : [...prev, marketplaceId]
    );
  };

  const handlePost = async () => {
    if (selectedMarketplaces.length === 0) {
      toast.error("Please select at least one marketplace");
      return;
    }

    setPosting(true);
    setProgress(0);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      const response = await axios.post(
        `${API}/listings/${listing.id}/post-to-marketplaces`,
        selectedMarketplaces
      );

      clearInterval(progressInterval);
      setProgress(100);
      setPostingResults(response.data);
      
      if (response.data.total_posted > 0) {
        toast.success(`Successfully posted to ${response.data.total_posted} marketplace${response.data.total_posted > 1 ? 's' : ''}!`);
      }
      
      if (response.data.total_failed > 0) {
        toast.error(`Failed to post to ${response.data.total_failed} marketplace${response.data.total_failed > 1 ? 's' : ''}`);
      }

      if (onPostingComplete) {
        onPostingComplete();
      }
    } catch (error) {
      console.error('Error posting to marketplaces:', error);
      toast.error("Failed to post to marketplaces");
    } finally {
      setPosting(false);
    }
  };

  const getStatusIcon = (success) => {
    return success ? (
      <CheckCircle className="h-4 w-4 text-green-600" />
    ) : (
      <XCircle className="h-4 w-4 text-red-600" />
    );
  };

  const getAuthStatusBadge = (marketplace) => {
    const statusColors = {
      connected: "bg-green-100 text-green-800",
      disconnected: "bg-red-100 text-red-800",
      expired: "bg-yellow-100 text-yellow-800"
    };

    return (
      <Badge className={`text-xs ${statusColors[marketplace.auth_status]}`}>
        {marketplace.auth_status === 'connected' ? '✓ Connected' : 
         marketplace.auth_status === 'expired' ? '⚠ Expired' : '✗ Not Connected'}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-orange-600 hover:bg-orange-700 text-white">
          <Share2 className="h-4 w-4 mr-2" />
          Post to Marketplaces
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-orange-600" />
            Post to Multiple Marketplaces
          </DialogTitle>
          <DialogDescription>
            Select the marketplaces where you want to post "{listing?.title}"
          </DialogDescription>
        </DialogHeader>

        {!postingResults ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {marketplaces.map((marketplace) => (
                <Card key={marketplace.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            checked={selectedMarketplaces.includes(marketplace.id)}
                            onCheckedChange={() => handleMarketplaceToggle(marketplace.id)}
                            disabled={marketplace.auth_status === 'disconnected' && marketplace.requires_auth}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <img 
                                src={marketplace.logo_url} 
                                alt={marketplace.name}
                                className="w-6 h-6 object-contain"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                              <h3 className="font-semibold text-sm">{marketplace.name}</h3>
                            </div>
                            <p className="text-xs text-gray-600 mb-2">{marketplace.description}</p>
                            {marketplace.requires_auth && getAuthStatusBadge(marketplace)}
                          </div>
                        </div>
                      </div>
                      
                      {marketplace.auth_status === 'disconnected' && marketplace.requires_auth && (
                        <div className="text-xs text-red-600 flex items-center gap-1">
                          <Settings className="h-3 w-3" />
                          Authentication required
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {selectedMarketplaces.length > 0 && (
              <div className="border-t pt-4">
                <p className="text-sm text-gray-600 mb-4">
                  Selected {selectedMarketplaces.length} marketplace{selectedMarketplaces.length > 1 ? 's' : ''}
                </p>
                
                {posting && (
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span>Posting to marketplaces...</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="w-full" />
                  </div>
                )}
                
                <div className="flex justify-end space-x-3">
                  <Button variant="outline" onClick={() => setOpen(false)} disabled={posting}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handlePost} 
                    disabled={posting || selectedMarketplaces.length === 0}
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    {posting ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Posting...
                      </>
                    ) : (
                      <>
                        <Share2 className="h-4 w-4 mr-2" />
                        Post to {selectedMarketplaces.length} Marketplace{selectedMarketplaces.length > 1 ? 's' : ''}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center py-4">
              <h3 className="text-lg font-semibold mb-2">Posting Results</h3>
              <div className="flex justify-center items-center gap-4 text-sm">
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  {postingResults.total_posted} successful
                </div>
                {postingResults.total_failed > 0 && (
                  <div className="flex items-center gap-1 text-red-600">
                    <XCircle className="h-4 w-4" />
                    {postingResults.total_failed} failed
                  </div>
                )}
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              {postingResults.results.map((result, index) => (
                <Card key={index} className={`border-l-4 ${result.success ? 'border-l-green-500' : 'border-l-red-500'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(result.success)}
                        <div>
                          <h4 className="font-medium text-sm">{result.marketplace_name}</h4>
                          {result.success ? (
                            <div className="space-y-1">
                              <p className="text-xs text-green-600">Posted successfully!</p>
                              {result.listing_url && (
                                <a 
                                  href={result.listing_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  View listing
                                </a>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-red-600">{result.error}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setOpen(false)} className="bg-orange-600 hover:bg-orange-700 text-white">
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// Create Listing Component
const CreateListing = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    condition: "",
    price: ""
  });
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);

  const conditions = [
    { value: "new", label: "New" },
    { value: "like_new", label: "Like New" },
    { value: "slightly_used", label: "Slightly Used" },
    { value: "used", label: "Used" },
    { value: "non_working", label: "Non Working" }
  ];

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleImageUpload = async (event, listingId) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API}/listings/${listingId}/images`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      const imageUrl = `${BACKEND_URL}${response.data.image_url}`;
      setImages(prev => [...prev, imageUrl]);
      toast.success("Image uploaded successfully!");
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error("Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async (imageUrl, listingId) => {
    try {
      const relativeUrl = imageUrl.replace(BACKEND_URL, '');
      const formData = new FormData();
      formData.append('image_url', relativeUrl);
      
      await axios.delete(`${API}/listings/${listingId}/images`, { data: formData });
      setImages(prev => prev.filter(img => img !== imageUrl));
      toast.success("Image removed successfully!");
    } catch (error) {
      console.error('Error removing image:', error);
      toast.error("Failed to remove image");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.description || !formData.condition || !formData.price) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      const response = await axios.post(`${API}/listings`, {
        ...formData,
        price: parseFloat(formData.price)
      });
      
      toast.success("Listing created successfully!");
      navigate('/');
    } catch (error) {
      console.error('Error creating listing:', error);
      toast.error("Failed to create listing");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link to="/" className="text-orange-600 hover:text-orange-700 font-medium">
            ← Back to Listings
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-4 mb-2">Create New Listing</h1>
          <p className="text-gray-600">Add your item details and images to create a new listing</p>
        </div>

        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-orange-600" />
              Item Details
            </CardTitle>
            <CardDescription>
              Fill in the information about your item
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-sm font-medium text-gray-700">
                    Item Title *
                  </Label>
                  <Input
                    id="title"
                    placeholder="Enter item title..."
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    className="border-gray-200 focus:border-orange-400 focus:ring-orange-400"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price" className="text-sm font-medium text-gray-700">
                    Price ($) *
                  </Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.price}
                    onChange={(e) => handleInputChange('price', e.target.value)}
                    className="border-gray-200 focus:border-orange-400 focus:ring-orange-400"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="condition" className="text-sm font-medium text-gray-700">
                  Condition *
                </Label>
                <Select onValueChange={(value) => handleInputChange('condition', value)}>
                  <SelectTrigger className="border-gray-200 focus:border-orange-400 focus:ring-orange-400">
                    <SelectValue placeholder="Select item condition" />
                  </SelectTrigger>
                  <SelectContent>
                    {conditions.map((condition) => (
                      <SelectItem key={condition.value} value={condition.value}>
                        {condition.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium text-gray-700">
                  Description *
                </Label>
                <Textarea
                  id="description"
                  placeholder="Describe your item in detail..."
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={4}
                  className="border-gray-200 focus:border-orange-400 focus:ring-orange-400"
                />
              </div>

              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/')}
                  className="border-gray-300 hover:bg-gray-50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  Create Listing
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Listings Dashboard Component
const ListingsDashboard = () => {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchListings();
  }, []);

  const fetchListings = async () => {
    try {
      const response = await axios.get(`${API}/listings`);
      setListings(response.data);
    } catch (error) {
      console.error('Error fetching listings:', error);
      toast.error("Failed to fetch listings");
    } finally {
      setLoading(false);
    }
  };

  const deleteListing = async (listingId) => {
    if (!window.confirm('Are you sure you want to delete this listing?')) return;
    
    try {
      await axios.delete(`${API}/listings/${listingId}`);
      setListings(prev => prev.filter(listing => listing.id !== listingId));
      toast.success("Listing deleted successfully!");
    } catch (error) {
      console.error('Error deleting listing:', error);
      toast.error("Failed to delete listing");
    }
  };

  const formatCondition = (condition) => {
    return condition.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading listings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Multi-Marketplace Seller</h1>
            <p className="text-gray-600">Manage your listings and post to multiple marketplaces</p>
          </div>
          <Link to="/create">
            <Button className="bg-orange-600 hover:bg-orange-700 text-white shadow-lg">
              <Plus className="h-4 w-4 mr-2" />
              Create Listing
            </Button>
          </Link>
        </div>

        {listings.length === 0 ? (
          <Card className="text-center py-16 shadow-xl border-0 bg-white/80 backdrop-blur-sm">
            <CardContent>
              <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No listings yet</h3>
              <p className="text-gray-600 mb-6">Create your first listing to get started</p>
              <Link to="/create">
                <Button className="bg-orange-600 hover:bg-orange-700 text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Listing
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((listing) => (
              <Card key={listing.id} className="shadow-lg border-0 bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                        {listing.title}
                      </CardTitle>
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        <span className="text-2xl font-bold text-green-600">
                          ${listing.price.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteListing(listing.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Badge variant="secondary" className="w-fit bg-orange-100 text-orange-800">
                    <Tag className="h-3 w-3 mr-1" />
                    {formatCondition(listing.condition)}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 text-sm line-clamp-3 mb-4">
                    {listing.description}
                  </p>
                  
                  {listing.images && listing.images.length > 0 ? (
                    <div className="mb-4">
                      <img
                        src={`${BACKEND_URL}${listing.images[0]}`}
                        alt={listing.title}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      {listing.images.length > 1 && (
                        <p className="text-xs text-gray-500 mt-1">
                          +{listing.images.length - 1} more image{listing.images.length > 2 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="mb-4 h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Package className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">
                      Created {new Date(listing.created_at).toLocaleDateString()}
                    </span>
                    <Button size="sm" variant="outline" className="text-orange-600 border-orange-200 hover:bg-orange-50">
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ListingsDashboard />} />
          <Route path="/create" element={<CreateListing />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </div>
  );
}

export default App;