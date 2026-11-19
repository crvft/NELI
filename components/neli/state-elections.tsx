'use client';

import * as React from 'react';
import type { RegionOverview } from '@/lib/region';
import { Card } from './card';
import { RegionDashboard } from './region-dashboard';
import { SortMenu, type SortOption } from './sort-menu';
import { LegislativeView, type LegislativeYear } from './legislative-view';

type StateType = 'presidential' | 'governorship' | 'senate' | 'reps' | 'assembly';

const subscribeNoop = () => () => {};
const readTypeParam = () => new URLSearchParams(window.location.search).get('type');

/**
 * A state's election analytics with a picker for the kind of election. Presidential
 * and governorship results are on record; Senate and House of Assembly results are
 * listed so it's clear they're coming, with an honest empty state until they are.
 * The choice lives in the URL (?type=governorship) so a view can be shared.
 */
export function StateElections({
  name,
  overviews,
  legislative,
  children,
}: {
  name: string;
  overviews: Record<'presidential' | 'governorship', RegionOverview>;
  legislative: Record<'senate' | 'reps', LegislativeYear[]>;
  children?: React.ReactNode;
}) {
  const races = (ys: LegislativeYear[]) => ys.reduce((s, y) => s + y.races.length, 0);
  const urlType = React.useSyncExternalStore(subscribeNoop, readTypeParam, () => null);
  const [picked, setPicked] = React.useState<StateType | null>(null);
  const options: SortOption<StateType>[] = [
    { value: 'presidential', label: 'Presidential', hint: `${overviews.presidential.cycles.length} elections on record` },
    { value: 'governorship', label: 'Governorship', hint: `${overviews.governorship.cycles.length} elections on record` },
    { value: 'senate', label: 'Senate', hint: legislative.senate.length ? `${races(legislative.senate)} races, ${legislative.senate[0].year}–${legislative.senate[legislative.senate.length - 1].year}` : 'Not on record yet' },
    { value: 'reps', label: 'House of Reps', hint: legislative.reps.length ? `${races(legislative.reps)} races, ${legislative.reps.map((y) => y.year).join(', ')}` : 'Not on record yet' },
    { value: 'assembly', label: 'House of Assembly', hint: 'Not on record yet' },
  ];
  const type: StateType = picked ?? (options.some((o) => o.value === urlType) ? (urlType as StateType) : 'presidential');

  function choose(v: StateType) {
    setPicked(v);
    const url = new URL(window.location.href);
    if (v === 'presidential') url.searchParams.delete('type');
    else url.searchParams.set('type', v);
    url.searchParams.delete('cycle'); // years differ between election types
    window.history.replaceState(null, '', url);
  }

  const control = <SortMenu value={type} onChange={choose} options={options} prefix='Election:' menuTitle='Election type' icon={false} align='start' className='h-8' />;

  if ((type === 'senate' || type === 'reps') && legislative[type].length) {
    return (
      <div className='flex flex-col gap-6'>
        <LegislativeView key={type} chamber={type} years={legislative[type]} name={name} control={control} />
        {children}
      </div>
    );
  }
  const noGovernor = type === 'governorship' && overviews.governorship.cycles.length === 0;
  if (type === 'senate' || type === 'reps' || type === 'assembly' || noGovernor) {
    return (
      <div className='flex flex-col gap-6'>
        <div className='flex items-center gap-3'>{control}</div>
        <Card className='flex flex-col items-start gap-1.5 p-5'>
          <h2 className='text-label-md text-text-strong-950'>
            {noGovernor
              ? `${name.charAt(0).toUpperCase()}${name.slice(1)} has no governorship elections`
              : `${type === 'senate' ? 'Senate' : type === 'reps' ? 'House of Reps' : 'House of Assembly'} results for ${name} aren’t on NELI’s record yet`}
          </h2>
          <p className='text-paragraph-sm text-text-sub-600 max-w-prose'>
            {noGovernor
              ? 'The Federal Capital Territory is run by a minister appointed by the President, and its area councils elect chairmen instead.'
              : type === 'reps'
                ? 'House of Representatives results are on record for 2015 (some states), 2019 and 2023.'
                : type === 'senate'
              ? `${name} elects ${name === 'FCT' ? 'one senator' : 'three senators, one per senatorial district'}. These results are next in NELI's import, after presidential and governorship races.`
              : 'State Assembly results come constituency by constituency and are planned after the Senate and House of Representatives.'}
          </p>
        </Card>
        {children}
      </div>
    );
  }

  return (
    // key: switching type remounts the dashboard so its cycle tabs reset
    <RegionDashboard key={type} overview={overviews[type]} typeControl={control}>
      {children}
    </RegionDashboard>
  );
}
