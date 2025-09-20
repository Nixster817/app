import requests
import sys
import json
from datetime import datetime

class MultiMarketplaceAPITester:
    def __init__(self, base_url="https://multi-market-sell.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.created_listing_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}" if not endpoint.startswith('http') else endpoint
        headers = {'Content-Type': 'application/json'} if not files else {}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files)
                else:
                    response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, list):
                        print(f"   Response: List with {len(response_data)} items")
                    elif isinstance(response_data, dict):
                        print(f"   Response keys: {list(response_data.keys())}")
                except:
                    print(f"   Response: {response.text[:100]}...")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")

            return success, response.json() if response.content and response.status_code < 400 else {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_get_marketplaces(self):
        """Test getting available marketplaces"""
        success, response = self.run_test(
            "Get Marketplaces",
            "GET",
            "marketplaces",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} marketplaces")
            # Check for expected marketplaces
            marketplace_names = [m.get('name', '') for m in response]
            expected_marketplaces = ['Facebook Marketplace', 'eBay', 'Craigslist', 'Etsy', 'Amazon Marketplace', 'Mercari', 'OfferUp', 'Poshmark']
            
            for expected in expected_marketplaces:
                if expected in marketplace_names:
                    print(f"   ✓ Found {expected}")
                else:
                    print(f"   ✗ Missing {expected}")
        
        return success

    def test_create_listing(self):
        """Test creating a new listing"""
        test_listing = {
            "title": f"Test Item {datetime.now().strftime('%H%M%S')}",
            "description": "This is a test listing created by automated testing",
            "condition": "like_new",
            "price": 99.99
        }
        
        success, response = self.run_test(
            "Create Listing",
            "POST",
            "listings",
            200,
            data=test_listing
        )
        
        if success and 'id' in response:
            self.created_listing_id = response['id']
            print(f"   Created listing with ID: {self.created_listing_id}")
            
            # Verify all fields are correct
            for key, value in test_listing.items():
                if key in response and response[key] == value:
                    print(f"   ✓ {key}: {value}")
                else:
                    print(f"   ✗ {key}: Expected {value}, got {response.get(key)}")
        
        return success

    def test_get_listings(self):
        """Test getting all listings"""
        success, response = self.run_test(
            "Get All Listings",
            "GET",
            "listings",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} listings")
            if self.created_listing_id:
                # Check if our created listing is in the list
                found_our_listing = any(listing.get('id') == self.created_listing_id for listing in response)
                if found_our_listing:
                    print(f"   ✓ Found our created listing in the list")
                else:
                    print(f"   ✗ Our created listing not found in the list")
        
        return success

    def test_get_single_listing(self):
        """Test getting a single listing by ID"""
        if not self.created_listing_id:
            print("❌ Skipping - No listing ID available")
            return False
            
        success, response = self.run_test(
            "Get Single Listing",
            "GET",
            f"listings/{self.created_listing_id}",
            200
        )
        
        if success and response.get('id') == self.created_listing_id:
            print(f"   ✓ Retrieved correct listing")
            print(f"   Title: {response.get('title')}")
            print(f"   Price: ${response.get('price')}")
            print(f"   Condition: {response.get('condition')}")
        
        return success

    def test_post_to_marketplaces(self):
        """Test posting listing to multiple marketplaces"""
        if not self.created_listing_id:
            print("❌ Skipping - No listing ID available")
            return False
            
        # Test with multiple marketplaces including connected (Craigslist) and disconnected ones
        marketplace_ids = ["craigslist", "facebook", "ebay"]
        
        success, response = self.run_test(
            "Post to Marketplaces",
            "POST",
            f"listings/{self.created_listing_id}/post-to-marketplaces",
            200,
            data=marketplace_ids
        )
        
        if success:
            print(f"   Total posted: {response.get('total_posted', 0)}")
            print(f"   Total failed: {response.get('total_failed', 0)}")
            
            results = response.get('results', [])
            for result in results:
                marketplace_name = result.get('marketplace_name', 'Unknown')
                if result.get('success'):
                    print(f"   ✓ {marketplace_name}: Success - {result.get('listing_url', 'No URL')}")
                else:
                    print(f"   ✗ {marketplace_name}: Failed - {result.get('error', 'No error message')}")
        
        return success

    def test_get_listing_postings(self):
        """Test getting posting results for a listing"""
        if not self.created_listing_id:
            print("❌ Skipping - No listing ID available")
            return False
            
        success, response = self.run_test(
            "Get Listing Postings",
            "GET",
            f"listings/{self.created_listing_id}/postings",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} posting records")
            for posting in response:
                marketplace_id = posting.get('marketplace_id', 'Unknown')
                status = posting.get('status', 'Unknown')
                print(f"   {marketplace_id}: {status}")
        
        return success

    def test_update_listing(self):
        """Test updating a listing"""
        if not self.created_listing_id:
            print("❌ Skipping - No listing ID available")
            return False
            
        update_data = {
            "title": f"Updated Test Item {datetime.now().strftime('%H%M%S')}",
            "price": 149.99
        }
        
        success, response = self.run_test(
            "Update Listing",
            "PUT",
            f"listings/{self.created_listing_id}",
            200,
            data=update_data
        )
        
        if success:
            print(f"   Updated title: {response.get('title')}")
            print(f"   Updated price: ${response.get('price')}")
        
        return success

    def test_delete_listing(self):
        """Test deleting a listing"""
        if not self.created_listing_id:
            print("❌ Skipping - No listing ID available")
            return False
            
        success, response = self.run_test(
            "Delete Listing",
            "DELETE",
            f"listings/{self.created_listing_id}",
            200
        )
        
        if success:
            print(f"   ✓ Listing deleted successfully")
            # Verify it's actually deleted
            verify_success, _ = self.run_test(
                "Verify Deletion",
                "GET",
                f"listings/{self.created_listing_id}",
                404
            )
            if verify_success:
                print(f"   ✓ Confirmed listing is deleted")
        
        return success

    def test_invalid_endpoints(self):
        """Test error handling for invalid requests"""
        print(f"\n🔍 Testing Error Handling...")
        
        # Test invalid listing ID
        success1, _ = self.run_test(
            "Invalid Listing ID",
            "GET",
            "listings/invalid-id",
            404
        )
        
        # Test invalid marketplace posting (empty list)
        if self.created_listing_id:
            success2, _ = self.run_test(
                "Empty Marketplace List",
                "POST",
                f"listings/{self.created_listing_id}/post-to-marketplaces",
                200,  # Should still return 200 but with empty results
                data=[]
            )
        else:
            success2 = True  # Skip if no listing
        
        # Test invalid listing creation (missing required fields)
        success3, _ = self.run_test(
            "Invalid Listing Creation",
            "POST",
            "listings",
            422,  # Validation error
            data={"title": "Incomplete listing"}
        )
        
        return success1 and success2 and success3

def main():
    print("🚀 Starting Multi-Marketplace Seller API Tests")
    print("=" * 60)
    
    tester = MultiMarketplaceAPITester()
    
    # Run all tests in sequence
    test_results = []
    
    # Basic functionality tests
    test_results.append(tester.test_get_marketplaces())
    test_results.append(tester.test_create_listing())
    test_results.append(tester.test_get_listings())
    test_results.append(tester.test_get_single_listing())
    
    # Core marketplace posting functionality
    test_results.append(tester.test_post_to_marketplaces())
    test_results.append(tester.test_get_listing_postings())
    
    # CRUD operations
    test_results.append(tester.test_update_listing())
    
    # Error handling
    test_results.append(tester.test_invalid_endpoints())
    
    # Cleanup
    test_results.append(tester.test_delete_listing())
    
    # Print final results
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    print(f"Total tests run: {tester.tests_run}")
    print(f"Tests passed: {tester.tests_passed}")
    print(f"Tests failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success rate: {(tester.tests_passed / tester.tests_run * 100):.1f}%")
    
    if tester.tests_passed == tester.tests_run:
        print("\n🎉 All tests passed! Backend API is working correctly.")
        return 0
    else:
        print(f"\n⚠️  {tester.tests_run - tester.tests_passed} test(s) failed. Please check the issues above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())