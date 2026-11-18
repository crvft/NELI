import { PEOPLE, OFFICE_LABEL } from '@/lib/data';
import { stateByCode } from '@/lib/geo';
import { currentParty, currentRole, personRecord } from '@/lib/analytics';
import { PageContainer, PageHeader, SampleBadge } from '@/components/neli/page-header';
import { PeopleBrowser, type PersonSummary } from '@/components/neli/people-browser';

export const metadata = { title: 'Politicians' };

export default function PoliticiansPage() {
  const items: PersonSummary[] = PEOPLE.map((p) => {
    const role = currentRole(p) ?? p.roles[0];
    const rec = personRecord(p.id).filter((r) => r.election.status === 'concluded');
    return {
      id: p.id,
      name: p.name,
      party: currentParty(p),
      office: role?.office,
      officeLabel: role ? OFFICE_LABEL[role.office] : 'Candidate',
      title: role ? (currentRole(p) ? role.title : `Former ${role.title}`) : 'Candidate, no office held',
      inOffice: !!currentRole(p),
      appointed: !!role?.appointed,
      state: stateByCode(role?.stateCode ?? p.origin).name,
      wins: rec.filter((r) => r.won).length,
      contests: rec.length,
      switches: p.partyHistory.length - 1,
    };
  });
  return (
    <PageContainer className='flex flex-col gap-6'>
      <PageHeader
        eyebrow={<SampleBadge />}
        title='Politicians'
        description='Profiles and track records for everyone elected or appointed, from LGA chairmen to the president.'
      />
      <PeopleBrowser items={items} />
    </PageContainer>
  );
}
