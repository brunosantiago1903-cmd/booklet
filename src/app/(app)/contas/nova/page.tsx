import type { Metadata } from "next";
import { AccountForm } from "@/components/account-form";
import { Card, PageHeader } from "@/components/ui";
import { getAppContext } from "@/lib/auth";
import { listMembers } from "@/lib/data";
import { saveAccount } from "../actions";

export const metadata: Metadata = { title: "Nova conta" };

export default async function NewAccountPage() {
  const { supabase, member } = await getAppContext();
  const members = await listMembers(supabase);
  return (
    <div>
      <PageHeader title="Nova conta ou cartão" back="/contas" />
      <Card className="p-4">
        <AccountForm
          action={saveAccount}
          members={members}
          defaults={{
            name: "",
            type: "checking",
            institution: "",
            ownerMemberId: member.id,
            initialBalance: "",
            creditLimit: "",
            closingDay: "",
            dueDay: "",
          }}
        />
      </Card>
    </div>
  );
}
