import { useWidgets } from '../../hooks/use-widgets.js';
import { Alert, Button } from '../ui/index.js';
import { TextWidget } from './TextWidget.js';

const pendingLabel = (count: number) =>
  count === 1 ? 'Adding widget…' : `Adding ${count} widgets…`;

/** The pod page: lets the user add text widgets and renders them in stored order. */
export function WidgetBoard() {
  const { state, reload, addWidget, deleteWidget, dismissNotice } = useWidgets();
  const isReady = state.phase === 'ready';

  return (
    <>
      <header className="board__header">
        <h1>Text widgets</h1>
        <Button variant="primary" disabled={!isReady} onClick={() => void addWidget()}>
          Add widget
        </Button>
        {isReady && state.pendingCreates > 0 && (
          <span className="muted" role="status">
            {pendingLabel(state.pendingCreates)}
          </span>
        )}
      </header>

      {state.phase === 'loading' && <p className="muted">Loading widgets…</p>}

      {state.phase === 'error' && <Alert message={state.message} onRetry={reload} />}

      {isReady && (
        <>
          {state.notice && <Alert message={state.notice} onDismiss={dismissNotice} />}
          {state.widgets.length === 0 ? (
            <p className="muted">No widgets yet. Click “Add widget” to create one.</p>
          ) : (
            <div className="board__list">
              {state.widgets.map((widget, index) => (
                <TextWidget key={widget.id} widget={widget} index={index} onDelete={deleteWidget} />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
