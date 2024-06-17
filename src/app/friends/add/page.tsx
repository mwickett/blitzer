import { getFilteredUsers } from "@/server/queries";
import SelectUser from "./SelectUser";

export default async function AddFriend() {
  const users = await getFilteredUsers();
  return <SelectUser users={users} />;
}
