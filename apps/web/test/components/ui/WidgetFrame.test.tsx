import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WidgetFrame } from '../../../src/components/ui/WidgetFrame.js';

describe('WidgetFrame', () => {
  it('renders a bordered region named by its title', () => {
    render(
      <WidgetFrame title="Text widget 1">
        <p>content</p>
      </WidgetFrame>,
    );

    const region = screen.getByRole('region', { name: 'Text widget 1' });
    expect(region).toHaveClass('widget-frame');
    expect(within(region).getByRole('heading', { name: 'Text widget 1' })).toBeInTheDocument();
    expect(within(region).getByText('content')).toBeInTheDocument();
  });

  it('renders optional actions in the header and a footer', () => {
    render(
      <WidgetFrame title="W" actions={<button>Delete</button>} footer={<span>Saved</span>}>
        body
      </WidgetFrame>,
    );

    const region = screen.getByRole('region', { name: 'W' });
    expect(within(region).getByRole('button', { name: 'Delete' }).closest('header')).toHaveClass(
      'widget-frame__header',
    );
    expect(within(region).getByText('Saved').closest('footer')).toHaveClass('widget-frame__footer');
  });

  it('omits the footer when none is given', () => {
    const { container } = render(<WidgetFrame title="W">body</WidgetFrame>);

    expect(container.querySelector('footer')).toBeNull();
  });

  it('can host any kind of widget content', () => {
    render(
      <WidgetFrame title="Video widget" className="video">
        <iframe title="embedded video" />
      </WidgetFrame>,
    );

    const region = screen.getByRole('region', { name: 'Video widget' });
    expect(region).toHaveClass('widget-frame', 'video');
    expect(within(region).getByTitle('embedded video')).toBeInTheDocument();
  });
});
