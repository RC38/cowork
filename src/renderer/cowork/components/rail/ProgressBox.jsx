// Progress card — the three-phase Thinking → Working → Reasoning rail
// for a streaming or completed turn. Chat-only; project view doesn't
// surface this since there's no live stream there.

import { useTranslation } from 'react-i18next';
import { RailCard } from './RailCard';
import { PhaseProgress } from '../thinking/PhaseProgress';

export function ProgressBox({
  steps = [],
  streamStatus = null,
  conversationId = '',
  onActivateStep,
  defaultOpen = true,
  maxBodyHeight = 300,
}) {
  const { t } = useTranslation();
  return (
    <RailCard title={t('rail.progress')} defaultOpen={defaultOpen} maxBodyHeight={maxBodyHeight}>
      <PhaseProgress
        steps={steps}
        streamStatus={streamStatus || (steps.length ? 'done' : null)}
        conversationId={conversationId}
        onActivateStep={onActivateStep}
      />
    </RailCard>
  );
}
