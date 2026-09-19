// Schedule a new task — modal that replaces the previous inline form.
// Used for both create and edit; pass `task` to enable edit mode.
//
// Layout: title (full width) → cadence + next-run (two columns) →
// project + model (two columns) → prompt textarea (full width, the
// most important field, sits last so it gets the room it needs).

import { useEffect, useState } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../ui/Modal';
import Ico from '../Icons';
import { useTranslation } from 'react-i18next';

const FONT_BODY = 'var(--font-body)';

function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function defaultNextRun() {
  return toLocalInput(new Date(Date.now() + 60 * 60 * 1000).toISOString());
}

const fieldLabel = {
  fontFamily: FONT_BODY, fontSize: 11.5, fontWeight: 500,
  color: 'var(--ink-3)', letterSpacing: '0.02em',
  textTransform: 'uppercase',
  marginBottom: 6,
};

const fieldInput = {
  width: '100%', boxSizing: 'border-box',
  padding: '8px 10px', borderRadius: 7,
  background: 'var(--surface-2)',
  border: '1px solid var(--line)',
  color: 'var(--ink)',
  fontFamily: FONT_BODY, fontSize: 13.5,
  outline: 'none',
};

// Native <select> elements paint their own chevron inside the right
// padding area, so the same `padding: 10px` that's fine on a text
// input feels cramped here — the chevron ends up flush with the
// border. Bumping the right padding gives the indicator some air.
const fieldSelect = {
  ...fieldInput,
  paddingRight: 28,
};

function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={fieldLabel}>{label}</span>
      {children}
    </label>
  );
}


export default function ScheduleTaskModal({
  open, onClose, onSubmit, onDelete,
  task,                    // when set → edit mode
  projects = [],
  models = [],
  defaultProjectPath = '',
  defaultModelId = '',
  busy = false,
  agentLabel,
}) {
  const { t } = useTranslation();
  const isEdit = !!task;

  const [form, setForm] = useState(() => emptyForm({ defaultProjectPath, defaultModelId }));
  const [error, setError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Whenever the modal opens (or the editing target changes), reset
  // form state so reopening doesn't show stale fields from a previous
  // pass.
  useEffect(() => {
    if (!open) return;
    setError('');
    setConfirmingDelete(false);
    if (task) {
      // The server stores the project as a NAME (`task.project`) and
      // the form's <select> uses path as its value. Hydrate the form
      // by resolving the name back to a path via `projects`. Earlier
      // versions read `task.projectPath` which the server never sets,
      // so editing always lost the project association.
      const taskProjectPath = (() => {
        if (task.projectPath) return task.projectPath;
        if (task.project) {
          const match = projects.find((p) => p.name === task.project);
          if (match?.path) return match.path;
        }
        return '';
      })();
      setForm({
        title:       task.title || '',
        prompt:      task.prompt || '',
        cadence:     task.cadence || 'once',
        nextRunAt:   toLocalInput(task.nextRunAt) || defaultNextRun(),
        projectPath: taskProjectPath || defaultProjectPath || '',
      });
    } else {
      setForm(emptyForm({ defaultProjectPath }));
    }
  }, [open, task?.id, defaultProjectPath, projects]);

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  async function handleSubmit() {
    if (!form.prompt.trim()) {
      setError(t('scheduled.modal.promptRequired'));
      return;
    }
    setError('');
    // The server's `ScheduleRequest` schema accepts `project` as a
    // bare project NAME (not a path) and ignores any unknown fields.
    // The earlier payload sent `project_path: <path>` which silently
    // dropped — every schedule landed with `project: null`, breaking
    // the project-pivoted card / list / count. Resolve the form's
    // path back to a name via `projects` and send the right field.
    const projectMatch = projects.find((p) => p.path === form.projectPath);
    const payload = {
      title:        form.title.trim() || form.prompt.trim().slice(0, 80),
      prompt:       form.prompt,
      cadence:      form.cadence,
      timezone:     Intl.DateTimeFormat().resolvedOptions().timeZone || 'local',
      next_run_at:  new Date(form.nextRunAt).toISOString(),
      project:      projectMatch?.name || null,
      // Scheduled tasks always use the user's configured default
      // model — exposing the picker here let people accidentally
      // pin a stale model id that's no longer valid.
      model:        null,
      enabled:      task?.enabled !== false,
    };
    try {
      await onSubmit(payload, task?.id || null);
      onClose?.();
    } catch (err) {
      setError(err?.message || 'Could not save schedule.');
    }
  }

  async function handleDelete() {
    if (!task?.id) return;
    setError('');
    try {
      await onDelete?.(task.id);
      onClose?.();
    } catch (err) {
      setError(err?.message || 'Could not delete schedule.');
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      labelledBy="schedule-modal-title"
      // Don't dismiss on backdrop click while saving.
      closeOnBackdrop={!busy}
      closeOnEsc={!busy}
    >
      <ModalHeader
        id="schedule-modal-title"
        title={isEdit ? t('scheduled.modal.titleEdit', 'Edit scheduled task') : t('scheduled.modal.title')}
        subtitle={isEdit
          ? t('scheduled.modal.subtitleEdit', `Update the cadence or prompt. {{agent}} picks up changes on the next run.`, { agent: agentLabel || 'VeriAgent' })
          : t('scheduled.modal.subtitleCreate', `{{agent}} runs this prompt on the cadence you set, while the desktop app is open.`, { agent: agentLabel || 'VeriAgent' })}
        onClose={onClose}
      />
      <ModalBody padding="18px 20px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label={t('scheduled.modal.titleField')}>
            <input
              type="text"
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder={t('scheduled.modal.titlePlaceholder')}
              autoFocus
              style={fieldInput}
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label={t('scheduled.modal.cadence')}>
              <select
                value={form.cadence}
                onChange={(e) => update('cadence', e.target.value)}
                style={fieldSelect}
              >
                <option value="once">{t('scheduled.modal.once')}</option>
                <option value="hourly">{t('scheduled.modal.hourly')}</option>
                <option value="daily">{t('scheduled.modal.daily')}</option>
                <option value="weekly">{t('scheduled.modal.weekly')}</option>
              </select>
            </Field>
            <Field label={t('scheduled.modal.nextRun')}>
              <input
                type="datetime-local"
                value={form.nextRunAt}
                onChange={(e) => update('nextRunAt', e.target.value)}
                style={fieldInput}
              />
            </Field>
          </div>

          <Field label={t('scheduled.modal.project')}>
            <select
              value={form.projectPath}
              onChange={(e) => update('projectPath', e.target.value)}
              style={fieldSelect}
            >
              <option value="">{t('scheduled.modal.noProject')}</option>
              {projects.map((p) => (
                <option key={p.path} value={p.path}>{p.name}</option>
              ))}
            </select>
          </Field>

          <Field label={t('scheduled.modal.prompt')}>
            <textarea
              value={form.prompt}
              onChange={(e) => update('prompt', e.target.value)}
              placeholder={t('scheduled.modal.promptPlaceholder', { agent: agentLabel || 'VeriAgent' })}
              rows={6}
              style={{ ...fieldInput, resize: 'vertical', lineHeight: 1.45 }}
            />
          </Field>

          {error && (
            <div style={{
              padding: '8px 10px', borderRadius: 7,
              background: 'color-mix(in srgb, var(--danger) 12%, var(--surface))',
              border: '1px solid color-mix(in srgb, var(--danger) 35%, transparent)',
              color: 'var(--danger)', fontSize: 12.5,
            }}>{error}</div>
          )}
        </div>
      </ModalBody>
      <ModalFooter align={isEdit ? 'space-between' : 'flex-end'}>
        {isEdit && onDelete && (
          confirmingDelete ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{t('scheduled.modal.confirmDelete', 'Delete this schedule?')}</span>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={busy}
                style={btnSecondary}
              >{t('scheduled.modal.cancel')}</button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy}
                style={btnDanger}
              >{t('scheduled.modal.delete', 'Delete')}</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              disabled={busy}
              style={{ ...btnSecondary, color: 'var(--danger)' }}
            >
              {Ico.trash ? Ico.trash(13) : null}
              <span style={{ marginLeft: Ico.trash ? 6 : 0 }}>{t('scheduled.modal.delete', 'Delete')}</span>
            </button>
          )
        )}
        {!isEdit && <span />}
        <div style={{ display: 'inline-flex', gap: 8 }}>
          <button type="button" onClick={onClose} disabled={busy} style={btnSecondary}>
            {t('scheduled.modal.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className="btn-primary"
          >
            {busy ? t('scheduled.modal.saving') : (isEdit ? t('scheduled.modal.saveChanges', 'Save changes') : t('scheduled.modal.create'))}
          </button>
        </div>
      </ModalFooter>
    </Modal>
  );
}


// ── Helpers ──

function emptyForm({ defaultProjectPath }) {
  return {
    title: '',
    prompt: '',
    cadence: 'once',
    nextRunAt: defaultNextRun(),
    projectPath: defaultProjectPath || '',
  };
}

const btnSecondary = {
  display: 'inline-flex', alignItems: 'center',
  background: 'transparent',
  border: '1px solid var(--line)',
  color: 'var(--ink-2)',
  padding: '7px 12px', borderRadius: 7,
  fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 500,
  cursor: 'pointer',
};

const btnDanger = {
  display: 'inline-flex', alignItems: 'center',
  background: 'var(--danger)',
  border: '1px solid var(--danger)',
  color: '#fff',
  padding: '7px 12px', borderRadius: 7,
  fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 500,
  cursor: 'pointer',
};
