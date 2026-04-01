import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import StructuredContextForm, {
  StructuredContextValues,
} from './StructuredContextForm';
import { MODELS, textModels } from '../../hooks/useModel';

export type MonitorConfig = {
  meetingName: string;
  background: string;
  primaryLanguage: string;
  secondaryLanguage: string;
  translationModel: string;
  topicModel: string;
};

type Props = {
  onStart: (config: MonitorConfig) => void;
};

type SelectOption = {
  value: string;
  label: string;
};

const DEFAULT_PRIMARY_LANGUAGE = 'ja-JP';
const DEFAULT_SECONDARY_LANGUAGE = 'en-US';
const primaryLanguageLabel = 'monitor.primary_language';
const secondaryLanguageLabel = 'monitor.secondary_language';
const primaryLanguageValue = `: ${DEFAULT_PRIMARY_LANGUAGE}`;
const secondaryLanguageValue = `: ${DEFAULT_SECONDARY_LANGUAGE}`;

const modelOptions: SelectOption[] = Array.from(
  new Map(
    textModels.map((model) => [
      model.modelId,
      {
        value: model.modelId,
        label: MODELS.modelDisplayName(model.modelId),
      },
    ])
  ).values()
);

const selectClassName =
  'w-full rounded border border-gray-600 bg-gray-700 p-2 text-sm text-white';

const MonitorSetup: React.FC<Props> = ({ onStart }) => {
  const { t } = useTranslation();
  const [contextValues, setContextValues] = useState<StructuredContextValues>({
    meetingName: '',
    background: '',
  });
  const [translationModel, setTranslationModel] = useState(
    modelOptions[0]?.value ?? ''
  );
  const [topicModel, setTopicModel] = useState(modelOptions[0]?.value ?? '');

  const canStart = useMemo(() => {
    return translationModel !== '' && topicModel !== '';
  }, [topicModel, translationModel]);

  const handleStart = () => {
    if (!canStart) {
      return;
    }

    onStart({
      ...contextValues,
      primaryLanguage: DEFAULT_PRIMARY_LANGUAGE,
      secondaryLanguage: DEFAULT_SECONDARY_LANGUAGE,
      translationModel,
      topicModel,
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-2xl rounded-lg bg-gray-800 p-8 shadow-2xl">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-semibold text-white">
              {t('monitor.title')}
            </h1>
          </div>

          <section className="space-y-4">
            <div className="rounded-lg border border-gray-700 bg-black/10 p-4">
              <div className="[&_input]:border-gray-600 [&_input]:bg-gray-700 [&_input]:text-white [&_input]:placeholder:text-gray-400 [&_label]:text-gray-300 [&_textarea]:border-gray-600 [&_textarea]:bg-gray-700 [&_textarea]:text-white [&_textarea]:placeholder:text-gray-400">
                <StructuredContextForm
                  values={contextValues}
                  onChange={setContextValues}
                />
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-gray-700 bg-black/10 p-4 text-sm text-gray-300">
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
              <div>
                <span>{t(primaryLanguageLabel)}</span>
                <span>{primaryLanguageValue}</span>
              </div>
              <div>
                <span>{t(secondaryLanguageLabel)}</span>
                <span>{secondaryLanguageValue}</span>
              </div>
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label
                className="text-sm font-medium text-gray-300"
                htmlFor="monitor-translation-model">
                {t('monitor.translation_model')}
              </label>
              <select
                id="monitor-translation-model"
                className={selectClassName}
                value={translationModel}
                onChange={(event) => setTranslationModel(event.target.value)}>
                {modelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label
                className="text-sm font-medium text-gray-300"
                htmlFor="monitor-topic-model">
                {t('monitor.topic_model')}
              </label>
              <select
                id="monitor-topic-model"
                className={selectClassName}
                value={topicModel}
                onChange={(event) => setTopicModel(event.target.value)}>
                {modelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <div className="flex justify-end">
            <button
              type="button"
              className="w-full rounded-lg bg-blue-600 px-8 py-3 text-base font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              disabled={!canStart}
              onClick={handleStart}>
              {t('monitor.start_recording')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonitorSetup;
