import { useTranslation } from 'react-i18next';
import MeetingMinutesRealtimeTranslation from '../components/MeetingMinutes/MeetingMinutesRealtimeTranslation';

const RealtimeTranslationPage = () => {
  const { t } = useTranslation();

  return (
    <div className="grid h-full grid-cols-12 pb-4">
      <div className="invisible col-span-12 my-0 flex h-0 items-center justify-center text-xl font-semibold lg:visible lg:my-5 lg:h-min print:visible print:my-5 print:h-min">
        {t('navigation.realtimeTranslation')}
      </div>

      <div className="col-span-12 col-start-1 mx-2 flex min-h-0 flex-col lg:col-span-10 lg:col-start-2 xl:col-span-10 xl:col-start-2">
        <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
          {t('realtimeTranslationPage.description')}
        </div>
        <MeetingMinutesRealtimeTranslation
          initialPrimaryLanguage="ja-JP"
          initialSecondaryLanguage="en-US"
          initialTranslationType="bidirectional"
        />
      </div>
    </div>
  );
};

export default RealtimeTranslationPage;
