
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function forceConfirmAllUsers() {
    console.log('🔍 Fetching user list...');
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
        console.error('❌ Error fetching users:', listError.message);
        return;
    }

    console.log(`✨ Found ${users.length} users. Activating accounts...`);

    for (const user of users) {
        if (!user.email_confirmed_at) {
            process.stdout.write(`⚡ Confirming: ${user.email}... `);
            const { error: updateError } = await supabase.auth.admin.updateUserById(
                user.id,
                { email_confirm: true }
            );
            if (updateError) {
                console.log(`❌ Failed: ${updateError.message}`);
            } else {
                console.log(`✅ Success`);
            }
        } else {
            console.log(`✔️ Already active: ${user.email}`);
        }
    }

    console.log('\n🏁 모든 기존 계정이 활성화되었습니다. 이제 대시보드 로그인만 하시면 됩니다!');
}

forceConfirmAllUsers();
