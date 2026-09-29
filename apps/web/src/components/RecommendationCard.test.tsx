import type { Recommendation } from '@clearsignal/schema';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RecommendationCard } from './RecommendationCard';

const rec: Recommendation = {
  id: 'kdg-mukkodlu',
  village_id: 'kdg-mukkodlu',
  place_name: 'Mukkodlu',
  taluka: 'Madikeri',
  grid_cell_id: '12.4900_75.7400_500m',
  centroid: { lat: 12.4905, lon: 75.7413 },
  composite_score: 54,
  band: 'M',
  components: { recency: 0.9, agreement: 0.25, reliability: 0.6 },
  reason_text:
    'Conflict: satellite flood extent says flooded, one SMS report says safe, within 45 minutes',
  oldest_source_age_sec: 2700,
  conflict_flag: true,
  stale_flag: false,
  missing_sources: ['sentinel-2-cdse'],
  contributing_event_ids: ['a', 'b'],
};

describe('RecommendationCard', () => {
  it('shows band, score, age, reason, conflict and missing-source chip', () => {
    render(<RecommendationCard rec={rec} rank={3} onOpen={() => {}} />);
    expect(screen.getByLabelText('MEDIUM confidence, score 54 of 100')).toBeTruthy();
    expect(screen.getByText('oldest 45 min')).toBeTruthy();
    expect(screen.getByText(/Sources disagree/)).toBeTruthy();
    expect(screen.getByText(/says safe/)).toBeTruthy();
    expect(screen.getByText('satellite optical silent')).toBeTruthy();
    expect(screen.getByText('Mukkodlu')).toBeTruthy();
  });

  it('opens the detail view on tap', () => {
    const onOpen = vi.fn();
    render(<RecommendationCard rec={{ ...rec, id: 'x' }} rank={1} onOpen={onOpen} />);
    fireEvent.click(screen.getAllByRole('button').at(-1) as HTMLElement);
    expect(onOpen).toHaveBeenCalledWith('x');
  });
});
