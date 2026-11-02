const memberFlag = (uid: string) => `finance-family-member:${uid}`;

/** Remembers someone is a family member, so a removal is noticed on their next visit. */
export function rememberMembership(uid: string, member: boolean) {
  try {
    const was = localStorage.getItem(memberFlag(uid)) !== null;
    if (member) localStorage.setItem(memberFlag(uid), '1');
    else localStorage.removeItem(memberFlag(uid));
    return was;
  } catch {
    return false;
  }
}
