/**
 * Clerk localization overrides to rename "Organization" → "Circle"
 * throughout all Clerk-rendered UI components.
 *
 * Limitation: Clerk's hosted Account Portal pages will still say
 * "Organization" — acceptable since those interactions are rare.
 */
export const circleLocalization = {
  organizationSwitcher: {
    action__createOrganization: "Create a circle",
    action__manageOrganization: "Manage circle",
    notSelected: "No circle selected",
    title: "Circle",
  },
  organizationProfile: {
    title: "Circle Settings",
    start: {
      title: "Circle Settings",
      subtitle: "Manage your circle settings",
    },
    membersPage: {
      title: "Members",
      action__invite: "Invite",
      start: {
        title: "Members",
      },
    },
  },
  createOrganization: {
    title: "Create Circle",
    formButtonSubmit: "Create circle",
  },
  organizationList: {
    title: "Your Circles",
    titleWithoutPersonal: "Your Circles",
    action__createOrganization: "Create circle",
    action__invitationAccept: "Join",
  },
};
