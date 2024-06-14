import { getFilteredUsers } from "@/server/queries";
import SelectUser from "./SelectUser";

export default async function AddFriend() {
  const users = await getFilteredUsers();
  console.log(users);
  return <SelectUser users={users} />;
}
