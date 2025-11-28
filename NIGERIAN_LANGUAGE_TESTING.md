# Nigerian Language Content Moderation - Testing Guide

## Overview

This document describes the test cases and testing approach for Nigerian language (Yoruba, Hausa, Igbo) content moderation in the Jevah gospel media platform.

## Test Coverage

### 1. Language Detection Tests

Tests the language detection utility to identify Nigerian languages from text content.

#### Yoruba Language Detection
- ✅ Detects Yoruba from text with Yoruba keywords
- ✅ Detects Yoruba gospel keywords
- ✅ Handles mixed Yoruba-English content

#### Hausa Language Detection
- ✅ Detects Hausa from text with Hausa keywords
- ✅ Detects Hausa gospel keywords

#### Igbo Language Detection
- ✅ Detects Igbo from text with Igbo keywords
- ✅ Detects Igbo gospel keywords

### 2. Gospel Keywords Detection

Tests the gospel keyword detection across all supported languages.

#### Supported Languages
- ✅ English gospel keywords
- ✅ Yoruba gospel keywords
- ✅ Hausa gospel keywords
- ✅ Igbo gospel keywords
- ✅ Mixed language gospel content

### 3. Content Moderation Tests

#### Yoruba Gospel Content
- ✅ Approves Yoruba gospel song transcripts
- ✅ Approves Yoruba gospel songs without preaching
- ✅ Approves Yoruba worship songs
- ✅ Approves Yoruba praise songs

#### Hausa Gospel Content
- ✅ Approves Hausa gospel song transcripts
- ✅ Approves Hausa praise songs

#### Igbo Gospel Content
- ✅ Approves Igbo gospel song transcripts
- ✅ Approves Igbo worship songs

#### Multilingual Content
- ✅ Approves mixed English-Yoruba gospel content
- ✅ Approves multilingual gospel videos
- ✅ Approves content with multiple Nigerian languages

#### Pure Gospel Songs (No Preaching)
- ✅ Approves Yoruba gospel songs without spoken words
- ✅ Approves Hausa gospel songs without preaching
- ✅ Approves gospel songs in any language without preaching

#### Non-Gospel Content Rejection
- ✅ Rejects secular content in any language
- ✅ Rejects inappropriate content regardless of language

### 4. Integration Tests

Tests the full flow from upload to moderation approval.

#### Full Flow Tests
- ✅ Yoruba gospel video upload flow
- ✅ Hausa gospel audio upload flow
- ✅ Igbo gospel song upload flow

### 5. Edge Cases

- ✅ Handles empty transcripts gracefully
- ✅ Handles very short transcripts
- ✅ Handles transcripts with special characters
- ✅ Handles mixed case transcripts

## Running Tests

### Jest Unit Tests

Run the comprehensive Jest test suite:

```bash
npm test tests/nigerian-language-content.spec.ts
```

Or run all tests:

```bash
npm test
```

### Manual Integration Tests

Run the manual integration test script:

```bash
node test-nigerian-language-content.js
```

Set environment variables if needed:

```bash
export API_BASE_URL=http://localhost:4000
export TEST_USER_EMAIL=test@example.com
export TEST_USER_PASSWORD=test123456

node test-nigerian-language-content.js
```

## Test Data Examples

### Yoruba Gospel Content

```
Transcript: "Jésù olúwa mi, dúpẹ́ lọwọ ọlọrun. Àdúrà fún ìgbàgbọ ni àwọn ọmọ"
Title: "Yoruba Gospel Song"
Expected: ✅ Approved
```

### Hausa Gospel Content

```
Transcript: "Yesu Ubangiji, Allah ya gode. Addu'a da ibada ga Allah"
Title: "Hausa Gospel Song"
Expected: ✅ Approved
```

### Igbo Gospel Content

```
Transcript: "Jisos Chineke, ekpere anyi biko. Ofufe na abụ maka Chiukwu"
Title: "Igbo Gospel Song"
Expected: ✅ Approved
```

### Multilingual Content

```
Transcript: "Jesus Christ, Jésù olúwa mi. Praise God, dúpẹ́ ọlọrun"
Title: "Mixed Gospel Song"
Expected: ✅ Approved
```

### Pure Gospel Songs (No Preaching)

```
Transcript: "Ọlọrun mi, ọlọrun mi, dúpẹ́ dúpẹ́"
Title: "Pure Yoruba Gospel Song"
Description: "Gospel song only, no preaching"
Expected: ✅ Approved
```

## Language Detection

The system uses multiple methods for language detection:

1. **Pattern Matching**: Basic keyword pattern matching for quick detection
2. **AI-Based Detection**: Gemini AI automatically detects language from audio/transcript
3. **Google Cloud Speech-to-Text**: Alternative language detection with multiple language codes

### Supported Language Codes

- `yo-NG`: Yoruba (Nigeria)
- `ha-NG`: Hausa (Nigeria)
- `ig-NG`: Igbo (Nigeria)
- `en-NG`: English (Nigeria)
- `en-US`: English (US)

## Moderation Prompt Features

The content moderation system is configured to:

1. ✅ Accept gospel content in ANY language (English, Yoruba, Hausa, Igbo, etc.)
2. ✅ Recognize that gospel songs without preaching are valid gospel content
3. ✅ Accept worship/praise songs in local languages
4. ✅ Analyze content and meaning, not just language
5. ✅ Reject non-gospel content regardless of language

## Key Test Assertions

### Must Approve

- Gospel songs in Nigerian languages (Yoruba, Hausa, Igbo)
- Pure gospel songs without preaching
- Worship/praise songs in any language
- Multilingual gospel content
- Contemporary gospel in local languages

### Must Reject

- Secular content (regardless of language)
- Inappropriate/explicit content
- Non-gospel music
- Content contrary to Christian values

## Continuous Testing

These tests should be run:

1. **Before deployment**: Full test suite
2. **After code changes**: Related test cases
3. **Regular regression**: Weekly/monthly
4. **New language support**: Add new test cases

## Adding New Test Cases

To add a new test case:

1. Add test data with transcript, title, and description
2. Define expected behavior (approved/rejected)
3. Add to appropriate test suite (Yoruba/Hausa/Igbo/Multilingual)
4. Update this documentation

Example:

```typescript
it("should approve new test case", async () => {
  const transcript = "Your test transcript here";
  const result = await moderationService.moderateContent({
    transcript,
    title: "Test Title",
    contentType: "music",
  });
  expect(result.isApproved).toBe(true);
});
```

## Troubleshooting

### Tests Failing

1. Check environment variables (GOOGLE_AI_API_KEY)
2. Verify API endpoints are accessible
3. Check moderation service is initialized correctly
4. Review error logs for details

### Language Not Detected

1. Verify transcript contains language-specific keywords
2. Check language detection utility is imported
3. Review pattern matching rules
4. Test with known good transcripts

## Related Files

- `tests/nigerian-language-content.spec.ts` - Jest test suite
- `test-nigerian-language-content.js` - Manual integration tests
- `src/utils/languageDetection.util.ts` - Language detection utility
- `src/service/transcription.service.ts` - Transcription service
- `src/service/contentModeration.service.ts` - Content moderation service

## Support

For issues or questions about Nigerian language content moderation:

1. Check test output for specific errors
2. Review moderation prompt configuration
3. Verify language detection patterns
4. Check API service status

---

**Last Updated**: 2024
**Test Coverage**: Comprehensive
**Status**: ✅ All tests passing

