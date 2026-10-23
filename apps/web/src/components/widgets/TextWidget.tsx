import type { Widget, WidgetId } from '@text-widgets/shared';
import { memo } from 'react';
import { useAutosave } from '../../hooks/use-autosave.js';
import { Button, StatusIndicator, TextArea, WidgetFrame } from '../ui/index.js';

export interface TextWidgetProps {
  widget: Widget;
  /** Zero-based position, used for human-readable labels. */
  index: number;
  onDelete: (id: WidgetId) => void;
}

/** One independently editable, auto-saving plain-text widget. */
export const TextWidget = memo(function TextWidget({ widget, index, onDelete }: TextWidgetProps) {
  const { text, setText, flush, retry, status } = useAutosave(widget.id, widget.text);
  const position = index + 1;

  return (
    <WidgetFrame
      title={`Text widget ${position}`}
      actions={
        <Button
          variant="danger"
          aria-label={`Delete widget ${position}`}
          onClick={() => onDelete(widget.id)}
        >
          Delete
        </Button>
      }
      footer={
        <>
          <StatusIndicator status={status} />
          {status === 'error' && <Button onClick={retry}>Retry save</Button>}
        </>
      }
    >
      <TextArea
        label={`Text for widget ${position}`}
        hideLabel
        showCount
        placeholder="Start typing…"
        value={text}
        onValueChange={setText}
        onBlur={flush}
      />
    </WidgetFrame>
  );
});
