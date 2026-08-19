// @ts-nocheck
// ── LooseThreadDrawer ──
// Formerly LTDrawer. Edits a single global loose thread and optionally moves
// it into a project.
//
//   <LooseThreadDrawer lt={thread} activeProjects={projects}
//     onUpdate={fn} onMove={fn} onDelete={fn} onClose={fn} />

import { Drawer, Field, Section } from './SharedUI';

export default function LooseThreadDrawer({ lt, activeProjects, variant, open, onUpdate, onMove, onClose, onDelete }) {
  if (!lt) return null;

  var projects = activeProjects || [];

  // NOTE: placement is a placeholder — trash can was intentionally pulled out
  // of the header per the shell redesign; revisit once content-level design
  // for this drawer is defined.
  var footer = (
    <button className="btn btn-ghost" style={{ color: 'var(--danger)', width: '100%', justifyContent: 'center' }} onClick={onDelete}>
      <span className="mi" style={{ fontSize: 16 }}>delete</span>Archive this thread
    </button>
  );

  return (
    <Drawer
      variant={variant || 'overlay'}
      open={open}
      title="Loose Thread"
      onClose={onClose}
      footer={footer}
    >
      <Field
        label="Title"
        key={lt.id + '-t'}
        defaultValue={lt.title || ''}
        placeholder="Give this thread a name..."
        onBlur={function (e) { onUpdate({ title: e.target.value }); }}
      />

      <Field
        label="Notes"
        key={lt.id + '-s'}
        defaultValue={lt.synopsis || ''}
        placeholder="Write freely — capture the idea, explore it, let it breathe..."
        onBlur={function (e) { onUpdate({ synopsis: e.target.value }); }}
      />

      {projects.length > 0 && (
        <Section label="Move to a project">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {projects.map(function (p) {
              return (
                <button key={p.id} className="btn btn-ghost" style={{ justifyContent: 'flex-start' }} onClick={function () { onMove(p.id); }}>
                  <span className="mi" style={{ fontSize: 16 }}>arrow_forward</span>{p.title}
                </button>
              );
            })}
          </div>
        </Section>
      )}
    </Drawer>
  );
}
