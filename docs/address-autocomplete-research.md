# Address Autocomplete API Research & Implementation Plan

## Summary

This document outlines options for implementing address autocomplete for the business address field, with a focus on free/low-cost solutions that work well for Australia.

## Requirements

- **Primary Focus**: Australia (AU addresses)
- **Cost**: Free tier preferred, or low cost (<$100/month for typical usage)
- **Scope**: Dashboard implementation initially, with mobile app in mind
- **Use Case**: Business address field in organization settings

## Selected Option

### Geoapify ⭐ (SELECTED - Updated)

**Overview:**

- Professional geocoding and maps platform
- Built on open data sources (OpenStreetMap)
- Good balance of features, pricing, and accuracy
- Excellent for Australian addresses

**Pricing:**

- **Free Plan**: $0/month
  - 3,000 requests/day (~90,000/month)
  - No credit card required
  - Commercial use allowed
  - Access to all APIs including Address Autocomplete
- **Starter Plan**: $49/month
  - 50,000 requests/day
  - Priority support
- **Business Plan**: $199/month
  - 200,000 requests/day
  - Dedicated support

**Pros:**

- ✅ **Generous free tier** (3,000 requests/day) - perfect for testing and low usage
- ✅ Good Australian address accuracy
- ✅ Commercial use allowed on free tier
- ✅ Simple API integration (GeoJSON format)
- ✅ Built on open data (no vendor lock-in)
- ✅ Clear documentation and examples
- ✅ React/React Native libraries available

**Cons:**

- ❌ Free tier is slightly lower than some alternatives (but sufficient for most use cases)

**API:**

- Autocomplete endpoint: `https://api.geoapify.com/v1/geocode/autocomplete`
- Documentation: https://apidocs.geoapify.com/docs/geocoding/address-autocomplete/
- Required params: `apiKey`, `text` (query string)
- Optional params: `limit`, `filter=countrycode:AU` (for Australia), `format=json`
- Response format: GeoJSON with `features` array, each feature has `properties` with address components

**Recommendation:** ✅ **Selected for implementation** - Excellent free tier with good Australian accuracy. Changed from LocationIQ due to better Australian address accuracy.

---

## Options Analysis

### 1. Geocode Earth

**Overview:**

- Uses **G-NAF (Geocoded National Address File)** for Australia - the authoritative government address dataset
- Built on open data, allowing permanent storage of results without licensing issues
- Privacy-focused (no selling of customer data)
- Founded by Mapzen team, in business since 2014

**Pricing:**

- **Lite Plan**: $100/month
  - 150,000 requests/month
  - Up to 10 requests/second
  - **2-week free trial** (no credit card required)
- **Basic Plan**: $200/month
  - 400,000 requests/month
  - Up to 10 requests/second

**Pros:**

- ✅ Uses official G-NAF data for Australia (most accurate)
- ✅ Reasonable pricing for small to medium usage
- ✅ Free trial available
- ✅ No vendor lock-in restrictions
- ✅ Can store results permanently
- ✅ Privacy-focused
- ✅ Good documentation and React/JavaScript support
- ✅ Global coverage (can expand beyond Australia later)

**Cons:**

- ❌ $100/month minimum cost (no true free tier)
- ❌ May be overkill for very low usage

**API:**

- Autocomplete endpoint: `https://api.geocode.earth/v1/autocomplete`
- Documentation: https://geocode.earth/docs/forward/autocomplete/
- React component available: https://geocode.earth/docs/components/autocomplete-element/

---

### 2. Google Places API

**Overview:**

- Industry standard, very comprehensive
- Excellent global coverage including Australia
- Used by millions of applications

**Pricing:**

- **Session-based pricing**: $0.017 per session
  - A session includes multiple autocomplete requests + 1 place details request
  - More cost-effective for multiple requests per address selection
- **$200/month credit** (free tier): ~11,764 sessions/month
- After free credit: Pay-as-you-go

**Pros:**

- ✅ Very accurate and comprehensive
- ✅ Excellent global coverage
- ✅ Generous free tier ($200 credit/month)
- ✅ Well-documented with good SDKs
- ✅ Industry standard (familiar to developers)

**Cons:**

- ❌ Can become expensive at scale
- ❌ Requires Google Maps API key
- ❌ Vendor lock-in concerns
- ❌ Must follow Google's terms of service (usage restrictions)

**API:**

- Autocomplete: Google Places API (New)
- Documentation: https://developers.google.com/maps/documentation/places/web-service/place-autocomplete

---

### 3. Mapbox Geocoding API

**Overview:**

- Popular mapping platform
- Good global coverage
- Part of broader mapping ecosystem

**Pricing:**

- **Free tier**: 100,000 requests/month
- **After free tier**: $0.50 per 1,000 requests
  - ~$50 per 100,000 additional requests

**Pros:**

- ✅ Generous free tier (100k requests/month)
- ✅ Good global coverage
- ✅ Part of broader mapping ecosystem

**Cons:**

- ❌ Accuracy may not be as good as Google/Geocode Earth for Australia
- ❌ Can become expensive after free tier
- ❌ Less specialized for address autocomplete

**API:**

- Geocoding API with autocomplete support
- Documentation: https://docs.mapbox.com/api/search/geocoding/

---

### 4. G-NAF Direct (Not Recommended)

**Overview:**

- Geocoded National Address File - official Australian government dataset
- Completely free and open data
- Released as open data in 2016

**Pricing:**

- Free (government dataset)

**Pros:**

- ✅ Completely free
- ✅ Official Australian data (most accurate)

**Cons:**

- ❌ Requires self-hosting and implementation
- ❌ Large dataset (requires significant infrastructure)
- ❌ No ready-made API (would need to build)
- ❌ Only covers Australia (no global expansion)
- ❌ Significant development time required

**Note:** While G-NAF is free, building and maintaining an autocomplete API from it would require substantial development effort and infrastructure costs.

---

## Recommendation

### **Recommended: Geocode Earth (Lite Plan)**

**Why:**

1. **Best for Australia**: Uses official G-NAF data, ensuring accuracy
2. **Cost-effective**: $100/month for 150k requests is reasonable for business use
3. **Free trial**: 2-week free trial allows testing without commitment
4. **Future-proof**: Can easily expand globally while maintaining Australia focus
5. **Privacy-friendly**: No data selling, can store results permanently
6. **Easy integration**: Good React/JavaScript support and documentation

**Usage Estimate:**

- If each business address field uses ~3 autocomplete requests per address entry
- 150,000 requests = ~50,000 address entries/month
- For an organization settings page, this should be more than sufficient

**Migration Path:**

- Start with 2-week free trial
- If usage is low, can downgrade or switch to Google (free tier)
- If usage grows, upgrade to Basic plan ($200/month for 400k requests)

---

### Alternative: Google Places API (If Free Tier Preferred)

**Why consider:**

- Free tier ($200 credit/month) could cover all usage for small/medium apps
- Industry standard, very reliable
- Good fallback if Geocode Earth doesn't work out

**Best for:**

- Very low usage scenarios
- Apps needing global coverage immediately
- Teams already using Google Maps ecosystem

---

## Implementation Plan

### Phase 1: Dashboard Implementation (Current Scope)

#### 1.1 Environment Configuration

**Add to `dashboard/lib/env.ts`:**

```typescript
NEXT_PUBLIC_GEOCODE_EARTH_API_KEY: z.string().optional(),
```

**Add to `.env.local`:**

```env
NEXT_PUBLIC_GEOCODE_EARTH_API_KEY=your_api_key_here
```

#### 1.2 Create Address Autocomplete Component

**File: `dashboard/components/ui/address-autocomplete.tsx`**

Features:

- Text input field with autocomplete dropdown
- Debounced API calls (300-500ms delay)
- Shows formatted address suggestions
- Handles selection and populates address field
- Error handling and loading states
- Australia-focused by default (can add country filter)

**Component Props:**

```typescript
interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string) => void;
  onSelect?: (
    fullAddress: string,
    addressComponents: AddressComponents
  ) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  country?: string; // Default: 'AU'
}
```

**Address Response Structure:**

```typescript
interface AddressComponents {
  street?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  formatted?: string;
}
```

#### 1.3 Integration Points

**Primary Integration:**

- `dashboard/app/dashboard/settings/page.tsx`
- Replace the `AutoSaveInput` for `business_address` field with `AddressAutocomplete`
- Store full formatted address in `business_address` field

**API Integration:**

- Use Geocode Earth Autocomplete API
- Endpoint: `https://api.geocode.earth/v1/autocomplete`
- Method: GET with query parameters
- API key: From environment variable

**Example Request:**

```typescript
const response = await fetch(
  `https://api.geocode.earth/v1/autocomplete?api_key=${apiKey}&text=${searchText}&layers=address&country=AU`
);
```

#### 1.4 Error Handling & Fallback

- If API key is missing: Show regular text input (graceful degradation)
- If API fails: Log error, allow manual entry
- Rate limiting: Handle 429 responses with retry logic
- Network errors: Show user-friendly error message

#### 1.5 Testing Considerations

- Test with real Australian addresses (Sydney, Melbourne, Brisbane, etc.)
- Test with partial addresses
- Test error scenarios (network failures, invalid API key)
- Test with slow network connections (loading states)
- Verify address format matches Australian standards

---

### Phase 2: Mobile App Integration (Future)

**Considerations:**

- Same API key can be used (if public) or via backend proxy
- React Native implementation similar to React
- Consider using native picker component for better mobile UX
- Cache recent addresses locally for offline support

**Backend Proxy Option:**

- Create Supabase Edge Function: `address-autocomplete`
- Proxy requests to Geocode Earth API
- Hide API key from client
- Add rate limiting and caching at edge function level

---

## Cost Analysis

### Scenario 1: Low Usage (Small Business)

- **Assumption**: 100 address entries/month
- **Requests**: ~300/month (3 requests per address)
- **Cost**: $0 (within Geocode Earth Lite free trial, or Google free tier)

### Scenario 2: Medium Usage (Growing Business)

- **Assumption**: 1,000 address entries/month
- **Requests**: ~3,000/month
- **Geocode Earth**: $100/month (Lite plan, plenty of headroom)
- **Google**: $0 (within free tier)
- **Mapbox**: $0 (within free tier)

### Scenario 3: High Usage (Large Business)

- **Assumption**: 10,000 address entries/month
- **Requests**: ~30,000/month
- **Geocode Earth**: $100/month (Lite plan)
- **Google**: ~$0.51/month (within free tier)
- **Mapbox**: $0 (within free tier)

**Recommendation:** Geocode Earth Lite plan ($100/month) is cost-effective for most scenarios, with plenty of room for growth. The free trial allows testing without commitment.

---

## Security Considerations

### API Key Management

**Option 1: Public Key (Client-Side)**

- Pros: Simple implementation, no backend changes
- Cons: API key exposed in client code
- Mitigation: Restrict API key to specific domains/IPs in Geocode Earth dashboard

**Option 2: Backend Proxy (Recommended)**

- Pros: API key hidden, can add caching/rate limiting
- Cons: Requires edge function implementation
- Implementation: Create Supabase Edge Function that proxies requests

**Recommendation:** Start with Option 1 (public key with domain restrictions), migrate to Option 2 if needed.

---

## Next Steps

1. **Sign up for Geocode Earth free trial** (2 weeks, no credit card)

   - URL: https://app.geocode.earth/users/sign_up
   - Get API key from dashboard

2. **Create address autocomplete component**

   - Implement basic autocomplete UI
   - Integrate Geocode Earth API
   - Add error handling

3. **Integrate into settings page**

   - Replace business_address input field
   - Test with real addresses
   - Verify address format

4. **Test and iterate**

   - Test with various Australian addresses
   - Verify accuracy and UX
   - Gather user feedback

5. **Monitor usage**
   - Track API usage during trial
   - Determine if Lite plan is sufficient
   - Plan for mobile app integration

---

## References

- **Geocode Earth**: https://geocode.earth/
- **Geocode Earth Docs**: https://geocode.earth/docs/
- **G-NAF**: Australian government address dataset
- **Google Places API**: https://developers.google.com/maps/documentation/places/web-service
- **Mapbox Geocoding**: https://docs.mapbox.com/api/search/geocoding/
