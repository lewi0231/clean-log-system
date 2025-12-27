# Fix Address Autocomplete in Mobile App

## Priority

**Low** - Feature is currently disabled via feature flag. Manual address entry works as fallback.

## Problem

Address autocomplete component (`mobile-app/components/ui/address-autocomplete.tsx`) is making successful API calls to Geoapify (200 OK responses) but returning 0 results even for valid Australian addresses.

## Current Behavior

- API requests are being made successfully (status 200)
- Response structure appears correct
- `features` array is empty or undefined
- No suggestions are displayed to users

## Expected Behavior

- User types address (e.g., "27 Murray St")
- Geoapify API returns address suggestions
- User can select from dropdown list
- Selected address populates the field

## Technical Details

### Environment

- React Native / Expo
- Geoapify API v1 geocode/autocomplete endpoint
- Country filter: `countrycode:au`

### API Request

```
GET https://api.geoapify.com/v1/geocode/autocomplete
  ?apiKey={key}
  &text={query}
  &limit=5
  &filter=countrycode:au
  &format=json
```

### Response Structure

Expected GeoJSON format:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "formatted": "...",
        "address_line1": "...",
        "city": "...",
        "state": "...",
        ...
      },
      "geometry": { ... }
    }
  ]
}
```

## Debugging Information

- Console logs show: `[AddressAutocomplete] Full API response` with response structure
- API key is correctly configured (requests are authenticated)
- Network requests are visible in debugger
- Response status: 200 OK
- Results count: 0

## Possible Causes

1. **Response parsing issue**: Response structure might differ from expected
2. **Filter too restrictive**: `countrycode:au` filter might be excluding valid results
3. **API key restrictions**: Geoapify API key might have restrictions limiting results
4. **Query format**: Address format might need adjustment for better matching
5. **React Native fetch limitations**: Possible issues with response parsing in RN environment

## Investigation Steps

1. [ ] Log full API response structure to understand actual format
2. [ ] Test API call without country filter to see if results appear
3. [ ] Test with different address formats (with/without city, state)
4. [ ] Verify API key permissions in Geoapify dashboard
5. [ ] Compare working dashboard implementation with mobile implementation
6. [ ] Test with curl/Postman to verify API behavior outside of React Native

## Related Files

- `mobile-app/components/ui/address-autocomplete.tsx` - Main component
- `mobile-app/components/field-renderer-nativebase.tsx` - Field renderer using autocomplete
- `mobile-app/app.json` - Feature flag: `extra.enableAddressAutocomplete`
- `dashboard/components/ui/address-autocomplete.tsx` - Working dashboard implementation (reference)

## Current Workaround

Feature is disabled via feature flag (`enableAddressAutocomplete: false` in `app.json`).
When disabled, address fields fall back to regular text input for manual entry.

## Acceptance Criteria

- [ ] Address autocomplete returns results for valid Australian addresses
- [ ] Users can select addresses from dropdown
- [ ] Selected address populates the field correctly
- [ ] Feature flag can be enabled to activate autocomplete
- [ ] Works consistently across iOS and Android

## Notes

- Address data is stored as plain text strings in `job.submission_data` JSONB column
- Field values are keyed by field config `name` (e.g., `submission_data.customer_address`)
- No special backend handling required - addresses are treated like any other text field
