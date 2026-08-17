import { ClientSecretCredential } from '@azure/identity';
import { Client } from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';
import type { M365ClassGroup, M365GroupMember } from './types';
import { groupDisplayToGradeRoom, isClassGroup, isGraphMockMode } from './types';

const MOCK_GROUPS: M365ClassGroup[] = [
  {
    id: 'mock-group-k1',
    displayName: 'Class-K-1',
    gradeRoom: 'K-1',
    members: [
      { id: 'm365-emma', displayName: 'Emma Smith', givenName: 'Emma', surname: 'Smith', mail: 'emma@school.local' },
      { id: 'm365-olivia', displayName: 'Olivia Brown', givenName: 'Olivia', surname: 'Brown', mail: 'olivia@school.local' },
      { id: 'm365-sophia', displayName: 'Sophia Williams', givenName: 'Sophia', surname: 'Williams', mail: 'sophia@school.local' },
    ],
  },
  {
    id: 'mock-group-34',
    displayName: 'Grade-3rd-4th',
    gradeRoom: '3rd-4th',
    members: [
      { id: 'm365-liam', displayName: 'Liam Johnson', givenName: 'Liam', surname: 'Johnson', mail: 'liam@school.local' },
    ],
  },
  {
    id: 'mock-group-teachers-k1',
    displayName: 'Class-K-1-Teachers',
    gradeRoom: 'K-1',
    members: [
      { id: 'm365-teacher-k1', displayName: 'Priya Teacher', givenName: 'Priya', surname: 'Teacher', mail: 'priya@school.local' },
    ],
  },
];

function getGraphClient(): Client {
  const tenantId = process.env.AZURE_TENANT_ID!;
  const clientId = process.env.AZURE_CLIENT_ID!;
  const clientSecret = process.env.AZURE_CLIENT_SECRET!;
  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ['https://graph.microsoft.com/.default'],
  });
  return Client.initWithMiddleware({ authProvider });
}

export async function fetchClassGroups(): Promise<M365ClassGroup[]> {
  if (isGraphMockMode()) {
    return MOCK_GROUPS.filter((g) => g.displayName.startsWith('Class-') || g.displayName.startsWith('Grade-'));
  }

  const client = getGraphClient();
  const groupsResponse = await client
    .api('/groups')
    .filter("startswith(displayName,'Class-') or startswith(displayName,'Grade-') or startswith(displayName,'SundaySchool-')")
    .select('id,displayName')
    .get();

  const groups: M365ClassGroup[] = [];

  for (const group of groupsResponse.value ?? []) {
    if (!isClassGroup(group.displayName)) continue;

    const membersResponse = await client
      .api(`/groups/${group.id}/members`)
      .select('id,displayName,givenName,surname,mail')
      .get();

    const members: M365GroupMember[] = (membersResponse.value ?? [])
      .filter((m: { '@odata.type'?: string }) => m['@odata.type'] === '#microsoft.graph.user')
      .map((m: { id: string; displayName: string; givenName?: string; surname?: string; mail?: string }) => ({
        id: m.id,
        displayName: m.displayName,
        givenName: m.givenName ?? m.displayName.split(' ')[0],
        surname: m.surname ?? m.displayName.split(' ').slice(1).join(' '),
        mail: m.mail ?? null,
      }));

    groups.push({
      id: group.id,
      displayName: group.displayName,
      gradeRoom: groupDisplayToGradeRoom(group.displayName),
      members,
    });
  }

  return groups;
}

export async function fetchTeacherClasses(userId: string): Promise<string[]> {
  if (isGraphMockMode()) {
    // Mock: teacher-k1 belongs to K-1 class group
    if (userId === 'mock-teacher' || userId.includes('teacher')) {
      return ['K-1'];
    }
    return [];
  }

  const client = getGraphClient();
  const response = await client.api(`/users/${userId}/memberOf`).select('displayName').get();

  const grades: string[] = [];
  for (const item of response.value ?? []) {
    const name = item.displayName as string;
    if (isClassGroup(name)) {
      grades.push(groupDisplayToGradeRoom(name));
    }
  }
  return [...new Set(grades)];
}

/** Delegated: parse memberOf from a user's bearer token (teacher SSO). */
export async function fetchTeacherClassesFromToken(_accessToken: string): Promise<string[]> {
  if (isGraphMockMode()) {
    return ['K-1'];
  }

  const response = await fetch('https://graph.microsoft.com/v1.0/me/memberOf?$select=displayName', {
    headers: { Authorization: `Bearer ${_accessToken}` },
  });
  if (!response.ok) throw new Error('Failed to fetch group membership');

  const data = await response.json();
  const grades: string[] = [];
  for (const item of data.value ?? []) {
    const name = item.displayName as string;
    if (isClassGroup(name)) {
      grades.push(groupDisplayToGradeRoom(name));
    }
  }
  return [...new Set(grades)];
}

export { MOCK_GROUPS };
