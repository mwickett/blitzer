/**
 * Clerk localization overrides to rename "Organization" → "Circle"
 * throughout all Clerk-rendered UI components.
 *
 * Limitation: Clerk's hosted Account Portal pages will still say
 * "Organization" — acceptable since those interactions are rare.
 *
 * Keys must match Clerk's __internal_LocalizationResource type.
 * Only override leaf string values — no invented nesting.
 */
export const circleLocalization = {
  organizationSwitcher: {
    action__createOrganization: "Create a circle",
    action__manageOrganization: "Manage circle",
    notSelected: "No circle selected",
    title: "Circle",
  },
  organizationProfile: {
    navbar: {
      title: "Circle Settings",
      description: "Manage your circle settings",
    },
    start: {
      headerTitle__members: "Members",
      headerTitle__general: "General",
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
