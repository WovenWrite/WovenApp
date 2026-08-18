// @ts-nocheck
// ── LooseThreadDrawer ──
// Formerly LTDrawer. Edits a single global loose thread and optionally moves
// it into a project.
//
//   <LooseThreadDrawer lt={thread} activeProjects={projects}
//     onUpdate={fn} onMove={fn} onDelete={fn} onClose={fn} />

import { Drawer, Section } from './SharedUI';

export default function LooseThreadDrawer({ lt, activeProjects, variant, open, onUpdate, onMove, onClose, onDelete }) {
  if (!lt) return null;

  var projects = activeProjects || [];

  var archiveBtn = (
    <button className="btn-icon btn-danger" onClick={onDelete} title="Archive this thread" aria-label="Archive thread">
      <span className="mi" style={{ fontSize: 18 }}>delete</span>
    </button>
  );

  return (
    <Drawer
      variant={variant || 'overlay'}
      open={open}
      title="Loose Thread"
      icon="linear_scale"
      onClose={onClose}
      headerExtra={archiveBtn}
      padded={false}
    >
      <Section label="Title">
        <input
          key={lt.id + '-t'}
          defaultValue={lt.title || ''}
          placeholder="Give this thread a name..."
          onBlur={function (e) { onUpdate({ title: e.target.value }); }}
        />
      </Section>

      <Section label="Notes">
        <textarea
          key={lt.id + '-s'}
          defaultValue={lt.synopsis || ''}
          placeholder="Write freely — capture the idea, explore it, let it breathe..."
          rows={14}
          style={{ resize: 'vertical' }}
          onBlur={function (e) { onUpdate({ synopsis: e.target.value }); }}
        />
      </Section>

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
