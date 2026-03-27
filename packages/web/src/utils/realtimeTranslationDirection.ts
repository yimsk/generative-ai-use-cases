import type { Transcript } from 'generative-ai-use-cases';

export const normalizeLanguageCode = (
  languageCode?: string
): string | undefined => {
  return languageCode?.toLowerCase();
};

export const inferLanguageFromText = (text: string): string | undefined => {
  const trimmed = text.trim();
  if (!trimmed) {
    return undefined;
  }

  let japaneseCount = 0;
  let asciiCount = 0;

  for (const char of trimmed) {
    const codePoint = char.codePointAt(0) ?? 0;

    if (
      (codePoint >= 0x3040 && codePoint <= 0x30ff) ||
      (codePoint >= 0x4e00 && codePoint <= 0x9faf)
    ) {
      japaneseCount += 1;
      continue;
    }

    if (
      (codePoint >= 0x41 && codePoint <= 0x5a) ||
      (codePoint >= 0x61 && codePoint <= 0x7a)
    ) {
      asciiCount += 1;
    }
  }

  if (japaneseCount > asciiCount && japaneseCount > 0) {
    return 'ja-jp';
  }

  if (asciiCount > 0) {
    return 'en-us';
  }

  return undefined;
};

export const resolveSourceLanguage = (
  transcripts: Transcript[],
  detectedLanguageCode: string | undefined,
  primaryLanguage: string,
  secondaryLanguage: string
): string | undefined => {
  const transcriptText = transcripts
    .map((transcript) => transcript.transcript)
    .join(' ')
    .trim();

  const inferredLanguage = inferLanguageFromText(transcriptText);
  if (inferredLanguage) {
    return inferredLanguage;
  }

  const normalizedDetected = normalizeLanguageCode(detectedLanguageCode);
  const normalizedPrimary = normalizeLanguageCode(primaryLanguage);
  const normalizedSecondary = normalizeLanguageCode(secondaryLanguage);

  if (normalizedDetected === normalizedPrimary) {
    return normalizedPrimary;
  }

  if (normalizedDetected === normalizedSecondary) {
    return normalizedSecondary;
  }

  return normalizedDetected;
};

export const getTranslationTarget = (
  translationType: string,
  sourceLanguageCode: string | undefined,
  primaryLanguage: string,
  secondaryLanguage: string
): string => {
  const normalizedSource = normalizeLanguageCode(sourceLanguageCode);
  const normalizedPrimary = normalizeLanguageCode(primaryLanguage);
  const normalizedSecondary = normalizeLanguageCode(secondaryLanguage);

  if (translationType !== 'bidirectional' || !normalizedSource) {
    return secondaryLanguage;
  }

  if (normalizedSource === normalizedPrimary) {
    return secondaryLanguage;
  }

  if (normalizedSource === normalizedSecondary) {
    return primaryLanguage;
  }

  return secondaryLanguage;
};
