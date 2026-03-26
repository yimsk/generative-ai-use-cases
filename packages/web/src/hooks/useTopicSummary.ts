import { useState, useRef, useCallback } from 'react';
import { getPrompter } from '../prompts';
import { findModelByModelId } from './useModel';
import useChatApi from './useChatApi';

export interface UseTopicSummaryOptions {
  modelId: string;
  targetLanguage: string;
  debounceMs?: number;
}

export interface UseTopicSummaryReturn {
  topic: string;
  isUpdating: boolean;
  error: string | null;
  updateTopic: (segment: string) => void;
}

const useTopicSummary = (options: UseTopicSummaryOptions): UseTopicSummaryReturn => {
  const { modelId, targetLanguage, debounceMs = 10000 } = options;
  const { predict } = useChatApi();

  const [topic, setTopic] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const lastCallRef = useRef<number>(0);

  const updateTopic = useCallback(
    async (segment: string) => {
      if (!segment.trim()) {
        return;
      }

      const now = Date.now();
      const timeSinceLastCall = now - lastCallRef.current;

      if (timeSinceLastCall < debounceMs) {
        return;
      }

      lastCallRef.current = now;
      setIsUpdating(true);
      setError(null);

      try {
        const id = '/topic-summary';
        const prompter = getPrompter(modelId);
        const systemPrompt = prompter.systemContext(id);
        const userPrompt = prompter.topicSummaryPrompt({
          currentTopic: topic,
          newSegment: segment,
          targetLanguage,
        });
        const model = findModelByModelId(modelId);

        if (!model) {
          throw new Error(`Model not found: ${modelId}`);
        }

        const messages = [
          {
            role: 'system' as const,
            content: systemPrompt,
          },
          {
            role: 'user' as const,
            content: userPrompt,
          },
        ];

        const result = await predict({
          model,
          messages,
          id,
        });

        const extracted = result
          .replace(/(<output>|<\/output>|<o>|<\/o>)/g, '')
          .trim();

        if (extracted.toLowerCase() === 'same') {
          return;
        } else {
          setTopic(extracted);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
      } finally {
        setIsUpdating(false);
      }
    },
    [modelId, targetLanguage, debounceMs, predict, topic]
  );

  return {
    topic,
    isUpdating,
    error,
    updateTopic,
  };
};

export default useTopicSummary;
