export type SourceLanguage = 'en' | 'ja';

export interface Segment {
  text: string;
  speakerLabel: string;
  timestamp: number;
  isPartial: boolean;
  sourceLanguage: SourceLanguage;
}

interface TranslationResponse {
  text: string;
}

const sanitizeTranslationText = (text: string): string => {
  return text.replace(/(<output>|<\/output>|<o>|<\/o>)/g, '').trim();
};

const parseTranslation = (
  translation: TranslationResponse | undefined
): { language: 'EN' | 'JP' | null; text: string } => {
  const rawText = sanitizeTranslationText(translation?.text ?? '');

  if (!rawText) {
    return { language: null, text: '' };
  }

  const separatorIndex = rawText.indexOf('|');
  if (separatorIndex === -1) {
    return { language: null, text: rawText };
  }

  const language = rawText.slice(0, separatorIndex).trim().toUpperCase();
  const text = rawText.slice(separatorIndex + 1).trim();

  if (language === 'EN' || language === 'JP') {
    return { language, text };
  }

  return { language: null, text: text || rawText };
};

export const sortSegmentsByLanguage = (
  segments: Segment[],
  translations: TranslationResponse[]
): { leftSegments: Segment[]; rightSegments: Segment[] } => {
  return segments.reduce(
    (acc, segment, index) => {
      const parsedTranslation = parseTranslation(translations[index]);

      if (!parsedTranslation.text) {
        return acc;
      }

      const translatedSegment: Segment = {
        ...segment,
        text: parsedTranslation.text,
      };

      const expectedLanguage = segment.sourceLanguage === 'ja' ? 'EN' : 'JP';
      if (
        parsedTranslation.language !== null &&
        parsedTranslation.language !== expectedLanguage
      ) {
        return acc;
      }

      if (segment.sourceLanguage === 'ja') {
        acc.leftSegments.push(translatedSegment);
      } else {
        acc.rightSegments.push(translatedSegment);
      }

      return acc;
    },
    { leftSegments: [] as Segment[], rightSegments: [] as Segment[] }
  );
};
