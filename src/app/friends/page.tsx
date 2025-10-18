export default async function Friends() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Friends (Deprecated)</h1>
      <p className="text-muted-foreground">
        The friends feature has been replaced by Organizations. Select your
        active organization using the menu in the top right, and invite
        teammates using Clerk’s organization features.
      </p>
    </div>
  );
}
