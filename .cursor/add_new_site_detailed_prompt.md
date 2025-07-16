# ImmoSearch: Add New Real Estate Site

You are an AI assistant for integrating new real estate platforms into ImmoSearch. Follow this process:

## 1. **Site Analysis**
- Validate URL with Playwright MCP
- Check for anti-bot measures (CAPTCHA, rate limiting)
- Determine scraping approach (HTML parsing, API, hybrid)
- Determine approach for handling Cookie banner

## 2. **Schema Mapping**
Map to internal schema:
```typescript
interface ListingData {
  id: string;           // Unique identifier
  title: string;        // Property title
  price: string;        // Price information
  location: string;     // Location/address
  details: string;      // Property details
  images: string[];     // Image URLs
  url: string;          // Direct link
  platform: string;     // Platform name
  timestamp: string;    // Found timestamp
}
```

## 3. **Implementation**
Follow existing patterns:

```typescript
// Platform-specific functions
async function checkPlatformXListings(page: Page): Promise<string[]>;
async function handlePlatformXCookieConsent(page: Page): Promise<void>;
async function extractPlatformXListingData(page: Page, url: string): Promise<ListingData>;

// Integration
if (PLATFORM_X_FILTER_URL) {
  await checkPlatformXListings(page);
}
```

**Requirements:**
- Error handling with retries
- Human-like behavior (delays, mouse movements)
- Cookie consent handling
- Rate limiting compliance

## 4. **Configuration**
```env
PLATFORM_X_FILTER_URL=https://example.com/search?filters=...
```

**Updates needed:**
- `getConfiguration()` function
- Interactive mode prompts
- Help text
- Tracking file: `data/platformx_listings.{instance}.json`

## 5. **Testing**
```typescript
describe('PlatformX Parser', () => {
  test('extract listing data correctly', async () => {});
  test('handle missing data gracefully', async () => {});
  test('handle cookie consent', async () => {});
});
```

**Validation:**
- [ ] All fields extracted correctly
- [ ] Missing data handled gracefully
- [ ] Cookie consent automated
- [ ] Rate limiting respected
- [ ] No duplicate notifications

## 6. **Integration**
1. Add to `checkAllServices()`:
```typescript
if (PLATFORM_X_FILTER_URL) {
  console.log('🔍 Checking PlatformX listings...');
  const newListings = await checkPlatformXListings(page);
}
```

2. Update configuration handling
3. Add to tracking system

## 7. **Documentation**
Update README.md:
```markdown
### PlatformX
- ✅ Cookie consent handling
- ✅ Listing tracking
- ✅ Human-like behavior
- ✅ Error handling

#### Setup
1. Go to [PlatformX](https://example.com)
2. Set filters and copy URL
3. Use as `PLATFORM_X_FILTER_URL`
```

## 8. **Legal & Quality**
- Respect robots.txt and rate limits
- Review terms of service
- Use proper user agent
- Comprehensive error handling
- TypeScript compliance

## Implementation Checklist

### Pre-Implementation
- [ ] Site analysis completed
- [ ] Access method determined
- [ ] Schema mapping defined
- [ ] Legal compliance verified

### Implementation
- [ ] Platform functions created
- [ ] Configuration updated
- [ ] Integration completed
- [ ] Error handling added

### Testing & Deployment
- [ ] Unit tests passing
- [ ] End-to-end testing done
- [ ] Documentation updated
- [ ] Monitoring configured

---

**Remember**: Follow existing patterns, prioritize maintainability, and ask for clarification when needed. 