import { useCallback } from 'react';
import useAgentCoreApi from './useAgentCoreApi';
import useChat from './useChat';
import {
  AgentCoreConfiguration,
  AgentCoreRuntimeRequest,
  Model,
} from 'generative-ai-use-cases';
import { parseAgentCoreEnvJson } from './useAgentCore';

// Get environment variables
const researchAgentEnabled =
  import.meta.env.VITE_APP_RESEARCH_AGENT_ENABLED === 'true';
const researchAgentRuntime = parseAgentCoreEnvJson<
  AgentCoreConfiguration | undefined
>(
  import.meta.env.VITE_APP_RESEARCH_AGENT_RUNTIME,
  undefined,
  'VITE_APP_RESEARCH_AGENT_RUNTIME'
);

export const useResearchAgent = (id: string) => {
  const {
    messages,
    rawMessages,
    isEmpty,
    clear,
    getModelId,
    setModelId,
    loading: chatLoading,
  } = useChat(id);

  const { loading: apiLoading, postMessage } = useAgentCoreApi(id);

  const getResearchRuntime = useCallback(() => {
    return researchAgentRuntime;
  }, []);

  const invokeResearchAgent = useCallback(
    async (params: {
      agentRuntimeArn: string;
      mode: 'technical-research' | 'mini-research' | 'general-research';
      prompt: string;
      model: Model;
      files?: File[];
      sessionId?: string;
      qualifier?: string;
    }) => {
      const previousMessages = rawMessages
        .filter((msg) => {
          if (msg.role === 'system') return false;
          if (msg.role === 'assistant' && msg.content.trim() === '')
            return false;
          return true;
        })
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
          trace: msg.trace,
          extraData: msg.extraData,
          llmType: msg.llmType,
          metadata: msg.metadata,
        }));

      const request: AgentCoreRuntimeRequest = {
        agentRuntimeArn: params.agentRuntimeArn,
        mode: params.mode,
        prompt: params.prompt,
        model: params.model,
        previousMessages: previousMessages,
        files: params.files,
        sessionId: params.sessionId,
        qualifier: params.qualifier,
        system_prompt: undefined,
        mcpServers: undefined,
      };

      await postMessage(request);
    },
    [rawMessages, postMessage]
  );

  return {
    messages,
    isEmpty,
    clear,
    loading: apiLoading || chatLoading,
    invokeResearchAgent,
    getResearchRuntime,
    getModelId,
    setModelId,
    researchAgentEnabled,
  };
};
