import { createClient } from '@supabase/supabase-js';
import { User, Box, Item, Record, PopulatedBox, RecordStatus, AdminNotification, AdminNotificationType } from '../types';

/**
 * SUPABASE CONFIGURATION
 */
const SUPABASE_URL = 'https://nmahyxprnlmaeirnwpez.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tYWh5eHBybmxtYWVpcm53cGV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2Nzg2NjUsImV4cCI6MjA4MDI1NDY2NX0.tREFekEYgvMWeFmRiOssBgIpcIZuohc6jbxZzQnZb0U';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Event Bus for Realtime Simulation (Supabase realtime triggers this)
type Listener = () => void;
const listeners: Listener[] = [];

const notify = () => {
  listeners.forEach(l => l());
};

export const subscribe = (listener: Listener) => {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index > -1) listeners.splice(index, 1);
  };
};

// Initialize Realtime Subscription
supabase.channel('public:all')
  .on('postgres_changes', { event: '*', schema: 'public' }, () => {
    console.log('Realtime update received');
    notify();
  })
  .subscribe();


// --- HELPER: FILE UPLOAD ---

export const uploadFile = async (file: File, path: string): Promise<string | null> => {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
        const filePath = `${path}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('borrowme-files')
            .upload(filePath, file);

        if (uploadError) {
            console.error('Upload Error:', JSON.stringify(uploadError));
            const err = uploadError as any;
            
            // Case 1: Bucket missing
            if (err.message?.includes('Bucket not found') || err.error === 'Bucket not found' || err.statusCode === '404') {
                 console.error('CRITICAL: The storage bucket "borrowme-files" does not exist. Please run the SQL script.');
                 alert('System Error: Storage bucket "borrowme-files" missing. Please ask admin to run the setup SQL.');
            }
            // Case 2: Permission denied (RLS)
            else if (err.statusCode === '403' || err.message?.includes('policy') || err.message?.includes('permission') || err.message?.includes('new row violates row-level security policy')) {
                 console.error('CRITICAL: Storage permission denied. RLS policies likely missing.');
                 alert('System Error: Upload permission denied. Please run the setup SQL to fix policies.');
            }
            
            return null;
        }

        const { data } = supabase.storage
            .from('borrowme-files')
            .getPublicUrl(filePath);

        return data.publicUrl;
    } catch (error) {
        console.error('File upload failed:', error);
        return null;
    }
};

// --- DATA MAPPING HELPERS (Snake_case DB -> CamelCase App) ---

const mapUser = (data: any): User => ({
    userId: data.id,
    name: data.name,
    email: data.email,
    phone: data.phone,
    role: data.role as 'user' | 'admin',
    avatarUrl: data.avatar_url,
    createdAt: data.created_at,
    notifyOnBorrow: data.notify_on_borrow,
    notifyOnReturn: data.notify_on_return,
    notifyOnRejected: data.notify_on_rejected
});

const mapBox = (data: any): Box => ({
    boxId: data.box_id,
    boxName: data.box_name,
    boxType: data.box_type,
    coverImageUrl: data.cover_image_url,
    createdAt: data.created_at,
    updatedAt: data.updated_at
});

const mapItem = (data: any): Item => ({
    itemId: data.item_id,
    boxId: data.box_id,
    itemName: data.item_name,
    itemStatus: data.item_status,
    itemImageUrl: data.item_image_url,
    createdAt: data.created_at,
    updatedAt: data.updated_at
});

const mapRecord = (data: any): Record => ({
    recordId: data.record_id,
    userId: data.user_id,
    userName: data.profiles?.name || 'ผู้ใช้ที่ถูกลบ', // Thai localization for deleted users
    userEmail: data.profiles?.email || '-',
    userPhone: data.profiles?.phone || '-',
    boxId: data.box_id,
    itemId: data.item_id,
    status: data.status,
    daysBorrowed: data.days_borrowed,
    borrowedAt: data.borrowed_at,
    returnRequestDate: data.return_request_date,
    returnedAt: data.returned_at,
    proofImageUrl: data.proof_image_url,
    adminNote: data.admin_note,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    dueSoonNotifiedAt: data.due_soon_notified_at
});

const mapNotification = (data: any): AdminNotification => ({
    id: data.id,
    adminId: data.admin_id,
    borrowId: data.borrow_id,
    type: data.type,
    title: data.title,
    message: data.message,
    isRead: data.is_read,
    createdAt: data.created_at
});


// --- AUTHENTICATION ---

export const loginUser = async (email: string, password: string): Promise<{ user: User | null, error: string | null }> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
        console.warn('Login failed:', error);
        return { user: null, error: error?.message || 'Login failed' };
    }
    
    // Fetch Profile - Use maybeSingle to avoid PGRST116 errors on empty result
    let { data: profile, error: profError } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
    
    if (profError) {
         // Case 1: Table missing or permission denied
         if (profError.code === 'PGRST205' || profError.message.includes('profiles')) {
             console.error('CRITICAL: Profiles table missing. Run the SQL script.');
             return { user: null, error: 'System Error: "profiles" table missing in database.' };
         }
         // Case 2: Permission denied (RLS policy missing)
         if (profError.code === '42501') {
             console.error('CRITICAL: RLS Policy Error (42501). Database policies likely missing.');
             return { user: null, error: 'System Error: Database permissions (RLS) missing. Run the SQL script.' };
         }
         console.error('Login Error fetching profile:', profError);
         return { user: null, error: 'Error fetching user profile.' };
    }
    
    // Case 3: Profile missing (Auth success, but no profile row) -> Auto-recovery
    if (!profile) {
         console.warn('User authenticated but profile missing. Attempting recovery...');
         const recoveryProfile = {
            id: data.user.id,
            email: data.user.email,
            name: 'User', // Placeholder
            phone: '',
            role: data.user.email === 'admin@example.com' ? 'admin' : 'user' // Auto-admin for specific email
         };
         const { error: recoveryError } = await supabase.from('profiles').upsert([recoveryProfile]);
         if (!recoveryError) {
             return { user: mapUser(recoveryProfile), error: null };
         } else {
             // If recovery fails, it might be due to 42501 (Permission Denied) on INSERT
             if (recoveryError.code === '42501') {
                 console.error('Recovery failed: Permission Denied (42501).');
                 return { user: null, error: 'System Error: Cannot create profile (Permission Denied).' };
             }
             console.error('Recovery failed:', recoveryError);
             return { user: null, error: 'Failed to create user profile.' };
         }
    }

    // Case 4: Auto-Promote 'admin@example.com' if they are stuck as 'user'
    if (data.user.email === 'admin@example.com' && profile.role !== 'admin') {
        console.log('Promoting admin@example.com to admin role...');
        const { error: updateError } = await supabase.from('profiles').update({ role: 'admin' }).eq('id', data.user.id);
        if (!updateError) {
            profile.role = 'admin';
        }
    }
    
    return { user: mapUser(profile), error: null };
};

export const registerUser = async (data: Omit<User, 'userId' | 'createdAt' | 'role'>): Promise<{ user: User | null, error: string | null }> => {
    // 1. SignUp
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
    });

    if (authError || !authData.user) {
        // Use warn instead of error to avoid red console logs for duplicate user scenarios
        console.warn('Registration auth failed:', authError?.message);
        return { user: null, error: authError?.message || 'Registration failed' };
    }

    // Check if session is missing (Email Confirmation Required)
    if (!authData.session && authData.user) {
        return { user: null, error: 'Email not confirmed' };
    }

    // 2. Insert Profile (Use Upsert to avoid duplicate key errors if profile exists)
    // Auto-assign 'admin' role if email is admin@example.com
    const role = data.email === 'admin@example.com' ? 'admin' : 'user';

    const newProfile = {
        id: authData.user.id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        role: role,
        notify_on_borrow: true,
        notify_on_return: true,
        notify_on_rejected: true
    };

    const { error: profileError } = await supabase.from('profiles').upsert([newProfile], { onConflict: 'id' });
    
    if (profileError) {
        // Handle missing table error specifically
        if (profileError.code === 'PGRST205' || profileError.message.includes('profiles')) {
            console.error('CRITICAL ERROR: Table "public.profiles" is missing in Supabase.');
            return { user: null, error: "System Error: Database setup incomplete (profiles table missing)." };
        }
        // Handle permission error
        if (profileError.code === '42501') {
            console.error('CRITICAL ERROR: Permission denied on profiles table (42501).');
            return { user: null, error: "System Error: Database permissions missing. Run SQL script." };
        }
        
        console.error('Profile creation failed:', profileError.message);
        return { user: null, error: profileError.message };
    }

    return { user: mapUser({ ...newProfile, created_at: new Date().toISOString() }), error: null };
};

export const resetPasswordEmail = async (email: string): Promise<{ success: boolean, error?: string }> => {
    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin, 
        });
        if (error) return { success: false, error: error.message };
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
};

export const logoutUser = async () => {
    try {
        await supabase.auth.signOut();
    } catch (e) {
        console.warn('SignOut error (ignored):', e);
    }
    localStorage.removeItem('boxbox_session'); // Clear any legacy local fallback
};

export const getCurrentUser = async (): Promise<User | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (profile) return mapUser(profile);
    return null;
};

// --- DATA ACCESS ---

export const getBoxes = async (): Promise<PopulatedBox[]> => {
    // Fetch Boxes
    const { data: boxes, error: boxError } = await supabase.from('boxes').select('*').order('created_at', { ascending: false });
    if (boxError) {
        if (boxError.message?.includes('Failed to fetch')) {
             console.warn('Network Error: Unable to fetch boxes (Network/CORS/Paused Project).');
             return [];
        }
        if (boxError.code === 'PGRST205' || boxError.code === '42P01') {
             console.warn('Table "boxes" missing in Supabase. Returning empty list.');
             return [];
        }
        if (boxError.code === '42501') {
             console.warn('Permission denied (42501) fetching boxes. Check RLS policies.');
             return [];
        }
        console.warn('Fetch boxes error:', boxError.message);
        return [];
    }

    // Fetch All Items to aggregate counts (Optimization: Could use SQL View or RPC)
    const { data: items, error: itemError } = await supabase.from('items').select('box_id, item_status');
    if (itemError) return [];

    return boxes.map(b => {
        const boxItems = items.filter((i: any) => i.box_id === b.box_id);
        return {
            ...mapBox(b),
            itemCount: boxItems.length,
            availableCount: boxItems.filter((i: any) => i.item_status === 'available').length
        };
    });
};

export const getBoxItems = async (boxId: string): Promise<Item[]> => {
    const { data, error } = await supabase.from('items').select('*').eq('box_id', boxId);
    if (error) return [];
    return data.map(mapItem);
};

export const getItems = async (): Promise<Item[]> => {
    const { data, error } = await supabase.from('items').select('*');
    if (error) return [];
    return data.map(mapItem);
}

export const getRecords = async (): Promise<Record[]> => {
    // 1. Fetch Records (Raw)
    const { data: records, error: recError } = await supabase
        .from('records')
        .select('*');
    
    if (recError) {
        // Handle Network Error
        if (recError.message && (recError.message.includes('Failed to fetch') || recError.message.includes('Network request failed'))) {
            console.warn('Connection Error: Failed to fetch records. The database might be unreachable or paused.');
            return [];
        }

        // Silently ignore table missing error to avoid console noise if script partial failed
        if (recError.code === 'PGRST205' || recError.code === '42P01' || recError.message.includes('records')) {
            return [];
        }
        // Handle Permission Denied (42501)
        if (recError.code === '42501') {
             console.warn('Get Records: Permission denied (42501). RLS policies likely missing.');
             return [];
        }
        console.error('Get records error:', JSON.stringify(recError));
        return [];
    }

    if (!records || records.length === 0) return [];

    // Sort client-side
    records.sort((a: any, b: any) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
    });

    // 2. Manual Join with Profiles (More robust than Supabase Join for now)
    const userIds = Array.from(new Set(records.map((r: any) => r.user_id).filter(Boolean)));
    
    let profilesMap: {[key: string]: any} = {};
    if (userIds.length > 0) {
        const { data: profiles, error: profError } = await supabase
            .from('profiles')
            .select('id, name, email, phone')
            .in('id', userIds);
            
        if (profiles && !profError) {
            profiles.forEach((p: any) => {
                profilesMap[p.id] = p;
            });
        }
    }

    // 3. Map to Application Type
    return records.map((r: any) => {
        const profile = profilesMap[r.user_id];
        // Inject profile data to match what mapRecord expects (data.profiles.name etc)
        // If profile is missing (e.g. deleted user), provide fallback
        const fallbackProfile = {
            name: 'ผู้ใช้ที่ถูกลบ',
            email: '-',
            phone: '-'
        };
        
        return mapRecord({
            ...r,
            profiles: profile || fallbackProfile
        });
    });
};

// --- SETTINGS ---

export const updateUserProfile = async (userId: string, data: Partial<User>): Promise<User | null> => {
    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.phone) updateData.phone = data.phone;
    if (data.avatarUrl) updateData.avatar_url = data.avatarUrl;
    if (data.notifyOnBorrow !== undefined) updateData.notify_on_borrow = data.notifyOnBorrow;
    if (data.notifyOnReturn !== undefined) updateData.notify_on_return = data.notifyOnReturn;
    if (data.notifyOnRejected !== undefined) updateData.notify_on_rejected = data.notifyOnRejected;

    const { data: updated, error } = await supabase.from('profiles').update(updateData).eq('id', userId).select().single();
    if (error) return null;
    return mapUser(updated);
};

export const changePassword = async (userId: string, oldPass: string, newPass: string): Promise<boolean> => {
    // Supabase handles password updates directly via updateUser
    const { error } = await supabase.auth.updateUser({ password: newPass });
    return !error;
};

export const deleteAccount = async (userId: string): Promise<void> => {
    // Requires Service Role for true deletion, or RPC. 
    // Client side typically can't delete user from auth.users easily without Edge Function.
    // For this prototype, we'll assume an RPC function exists or just delete profile data.
    // However, simplest "soft" delete is just removing from profiles which cascades?
    // We will call a Hypothetical RPC or just delete profile and signOut.
    await supabase.from('profiles').delete().eq('id', userId);
    await supabase.auth.signOut();
};

// --- ADMIN USER MANAGEMENT ---

export const getAllUsers = async (): Promise<User[]> => {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) return [];
    return data.map(mapUser);
};

export const adminDeleteUser = async (requesterUserId: string, targetUserId: string): Promise<{ success: boolean, message?: string }> => {
    // Logic check
    const { data: requester } = await supabase.from('profiles').select('role').eq('id', requesterUserId).single();
    if (requester?.role !== 'admin') return { success: false, message: 'Unauthorized' };

    const { error } = await supabase.from('profiles').delete().eq('id', targetUserId);
    if (error) return { success: false, message: error.message };
    
    notify(); // Trigger update
    return { success: true };
};

export const adminSendUserMessage = async (userId: string, subject: string, message: string): Promise<boolean> => {
    // Mock Email
    console.log(`Sending email to user ${userId}: ${subject} - ${message}`);
    return true;
};

export const adminCreateAdminUser = async (currentUserId: string, data: Pick<User, 'name' | 'phone' | 'email' | 'password'>): Promise<{ success: boolean, message?: string, user?: User }> => {
    try {
        // Use a secondary client to sign up the new user without ensuring the current session is preserved/not overwritten
        // This is a common workaround to allow an admin to create users without logging themselves out in client-side apps
        const tempClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
            }
        });

        const { data: authData, error: authError } = await tempClient.auth.signUp({
            email: data.email,
            password: data.password,
            options: {
                data: {
                    name: data.name,
                    phone: data.phone,
                }
            }
        });

        if (authError) {
             return { success: false, message: authError.message };
        }

        if (authData.user) {
             // If we have a session, we can insert the profile immediately
             if (authData.session) {
                 const newProfile = {
                    id: authData.user.id,
                    name: data.name,
                    email: data.email,
                    phone: data.phone,
                    role: 'admin',
                    notify_on_borrow: true,
                    notify_on_return: true,
                    notify_on_rejected: true
                };
                
                const { error: profileError } = await tempClient.from('profiles').insert([newProfile]);
                if (profileError) {
                    console.error('Profile creation failed for new admin:', profileError);
                    return { success: false, message: 'User created but profile setup failed: ' + profileError.message };
                }
                
                // Explicitly sign out the temp client
                await tempClient.auth.signOut();
                
                notify(); // Trigger update
                return { success: true, message: 'สร้างบัญชี Admin เรียบร้อยแล้ว' };
             } else {
                 return { success: true, message: 'สร้างบัญชีแล้ว กรุณายืนยันอีเมลเพื่อเปิดใช้งาน' };
             }
        }
        
        return { success: false, message: 'Failed to create user' };
    } catch (err: any) {
        console.error('Admin creation error:', err);
        return { success: false, message: err.message || 'Unknown error' };
    }
};


// --- BOX MANAGEMENT ---

export const createBox = async (name: string, type: string, coverUrl: string, newItems: {name: string, img: string, qty: number}[]): Promise<{ success: boolean, error?: string }> => {
    const newBoxId = `b${Date.now()}`;
    const { error: boxError } = await supabase.from('boxes').insert([{
        box_id: newBoxId,
        box_name: name,
        box_type: type,
        cover_image_url: coverUrl
    }]);

    if (boxError) {
        // Handle specific missing table error to help user
        if (boxError.code === '42P01' || boxError.code === 'PGRST205') {
            const msg = 'Missing table "boxes" in Supabase. Please run the SQL script.');
            console.error('Create Box Error:', msg);
            return { success: false, error: msg };
        }
        
        // Handle Permission Error
        if (boxError.code === '42501') {
             const msg = 'Permission denied on "boxes" table. RLS policies likely missing.';
             console.error('Create Box Error:', msg);
             return { success: false, error: msg };
        }

        // Stringify error to avoid [object Object] in logs/UI
        const errorMsg = typeof boxError === 'object' && boxError !== null ? JSON.stringify(boxError) : String(boxError);
        console.error('Create Box Error:', errorMsg);
        return { success: false, error: errorMsg };
    }

    const itemsPayload = [];
    newItems.forEach((itm, idx) => {
        for (let i = 0; i < itm.qty; i++) {
            itemsPayload.push({
                item_id: `i${Date.now()}-${idx}-${i}`,
                box_id: newBoxId,
                item_name: itm.name,
                item_image_url: itm.img,
                item_status: 'available'
            });
        }
    });

    if (itemsPayload.length > 0) {
        const { error: itemsError } = await supabase.from('items').insert(itemsPayload);
        if (itemsError) {
             const errorMsg = typeof itemsError === 'object' && itemsError !== null ? JSON.stringify(itemsError) : String(itemsError);
             console.error('Create Items Error:', errorMsg);
             return { success: false, error: 'Box created, but items failed: ' + (itemsError.message || 'Unknown error') };
        }
    }
    notify();
    return { success: true };
};

export const updateBox = async (boxId: string, boxUpdate: Partial<Box>, itemsConfig: {name: string, img: string, qty: number}[]): Promise<{ success: boolean, error?: string }> => {
    // Update Box
    const updatePayload: any = { updated_at: new Date().toISOString() };
    if (boxUpdate.boxName) updatePayload.box_name = boxUpdate.boxName;
    if (boxUpdate.boxType) updatePayload.box_type = boxUpdate.boxType;
    if (boxUpdate.coverImageUrl) updatePayload.cover_image_url = boxUpdate.coverImageUrl;

    const { error: updateError } = await supabase.from('boxes').update(updatePayload).eq('box_id', boxId);
    if (updateError) {
        if (updateError.code === '42501') {
             return { success: false, error: 'Permission denied (42501). Check RLS policies.' };
        }
        const errorMsg = typeof updateError === 'object' && updateError !== null ? JSON.stringify(updateError) : String(updateError);
        return { success: false, error: updateError.message || errorMsg };
    }

    // Sync Items
    const { data: existingItems, error: fetchError } = await supabase.from('items').select('*').eq('box_id', boxId);
    if (fetchError) {
        return { success: false, error: 'Failed to fetch items: ' + fetchError.message };
    }

    if (!existingItems) return { success: true };

    for (const config of itemsConfig) {
        const matches = existingItems.filter((i: any) => i.item_name === config.name);
        
        // Update images for existing
        if (matches.length > 0 && config.img) {
            await supabase.from('items').update({ item_image_url: config.img }).eq('item_name', config.name).eq('box_id', boxId);
        }

        const currentQty = matches.length;
        if (config.qty > currentQty) {
            const toAdd = config.qty - currentQty;
            const newItems = [];
            for(let k=0; k<toAdd; k++) {
                newItems.push({
                    item_id: `i${Date.now()}-${Math.random()}`,
                    box_id: boxId,
                    item_name: config.name,
                    item_image_url: config.img || matches[0]?.item_image_url,
                    item_status: 'available'
                });
            }
            const { error: addError } = await supabase.from('items').insert(newItems);
            if (addError) return { success: false, error: 'Failed to add items: ' + addError.message };

        } else if (config.qty < currentQty) {
            // Remove available items only
            const toRemove = currentQty - config.qty;
            const available = matches.filter((i: any) => i.item_status === 'available');
            const idsToDelete = available.slice(0, toRemove).map((i: any) => i.item_id);
            if (idsToDelete.length > 0) {
                const { error: delError } = await supabase.from('items').delete().in('item_id', idsToDelete);
                if (delError) return { success: false, error: 'Failed to remove items: ' + delError.message };
            }
        }
    }
    notify();
    return { success: true };
};

export const deleteBox = async (boxId: string) => {
    // 1. Delete associated records first to prevent orphaned data
    const { data: records } = await supabase.from('records').select('record_id').eq('box_id', boxId);
    if (records && records.length > 0) {
        await supabase.from('records').delete().eq('box_id', boxId);
    }
    
    // 2. Delete associated items
    await supabase.from('items').delete().eq('box_id', boxId);
    
    // 3. Delete the box itself
    await supabase.from('boxes').delete().eq('box_id', boxId);
    
    notify();
};

// --- BORROW FLOW ---

export const borrowBox = async (userId: string, boxId: string, days: number, proofUrl: string | null): Promise<number> => {
    // Fetch available items
    const { data: availableItems } = await supabase.from('items').select('*').eq('box_id', boxId).eq('item_status', 'available');
    
    if (!availableItems || availableItems.length === 0) return 0;

    const recordsPayload: any[] = [];
    const itemIds = availableItems.map((i: any) => i.item_id);

    availableItems.forEach((item: any) => {
        recordsPayload.push({
            record_id: `r${Date.now()}-${item.item_id}`,
            user_id: userId,
            box_id: boxId,
            item_id: item.item_id,
            status: 'borrowing',
            days_borrowed: days,
            borrowed_at: new Date().toISOString(),
            proof_image_url: proofUrl
        });
    });

    // Transaction: Insert Records & Update Items
    const { error: recError } = await supabase.from('records').insert(recordsPayload);
    if (!recError) {
        // Handle permission error on update specifically for Items table
        const { error: itemUpdateError } = await supabase.from('items').update({ item_status: 'borrowing', updated_at: new Date().toISOString() }).in('item_id', itemIds);
        
        if (itemUpdateError && itemUpdateError.code === '42501') {
            console.error('CRITICAL: Permission denied when updating items status. RLS policy missing.');
        }

        // Notification
        const { data: box } = await supabase.from('boxes').select('box_name').eq('box_id', boxId).single();
        const { data: user } = await supabase.from('profiles').select('name').eq('id', userId).single();
        
        await addAdminNotification({
            id: `borrow-${recordsPayload[0].record_id}`,
            adminId: null,
            borrowId: recordsPayload[0].record_id,
            type: "BORROW_CREATED",
            title: box?.box_name || 'Box',
            message: `${user?.name || 'User'} ยืมกล่องใหม่สำเร็จ`,
            isRead: false,
            createdAt: new Date().toISOString()
        });
    } else {
        if (recError.code === '42501') {
             console.error('CRITICAL: Permission denied when creating records. RLS policy missing.');
        }
    }

    notify();
    return availableItems.length;
};

// --- RETURN FLOW ---

export const requestReturnBatch = async (recordIds: string[], proofUrl: string): Promise<boolean> => {
    if (recordIds.length === 0) return false;

    // Fetch records to check previous rejections
    const { data: records } = await supabase.from('records').select('*').in('record_id', recordIds);
    if (!records || records.length === 0) return false;

    const wasRejected = records.some((r: any) => !!r.admin_note);
    const itemIds = records.map((r: any) => r.item_id);
    const firstRec = records[0];

    // Update Records
    await supabase.from('records').update({
        status: 'pendingReturn',
        return_request_date: new Date().toISOString(),
        proof_image_url: proofUrl,
        admin_note: null,
        updated_at: new Date().toISOString()
    }).in('record_id', recordIds);

    // Update Items
    await supabase.from('items').update({ item_status: 'pendingReturn', updated_at: new Date().toISOString() }).in('item_id', itemIds);

    // Notification
    const { data: user } = await supabase.from('profiles').select('name').eq('id', firstRec.user_id).single();
    const notifType = wasRejected ? "RETURN_REJECTED_NEW_REQUEST" : "RETURN_REQUESTED";
    const msg = wasRejected 
        ? `${user?.name} ส่งคำขอคืนใหม่ หลังจากถูกปฏิเสธ`
        : `${user?.name} ส่งคำขอคืนของ`;
    
    await addAdminNotification({
        id: `return-batch-${firstRec.record_id}-${Date.now()}`,
        adminId: null,
        borrowId: firstRec.record_id,
        type: notifType as any,
        title: 'Return Request',
        message: msg,
        isRead: false,
        createdAt: new Date().toISOString()
    });

    notify();
    return true;
};

export const adminApproveReturn = async (recordId: string, approved: boolean, note?: string): Promise<boolean> => {
    const { data: record } = await supabase.from('records').select('*').eq('record_id', recordId).single();
    if (!record) return false;

    if (approved) {
        await supabase.from('records').update({
            status: 'returned',
            returned_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }).eq('record_id', recordId);
        
        await supabase.from('items').update({ item_status: 'available' }).eq('item_id', record.item_id);
    } else {
        await supabase.from('records').update({
            status: 'borrowing',
            return_request_date: null,
            admin_note: note || "Rejected by admin",
            updated_at: new Date().toISOString()
        }).eq('record_id', recordId);

        await supabase.from('items').update({ item_status: 'borrowing' }).eq('item_id', record.item_id);
    }
    notify();
    return true;
};

export const adminBatchUpdateStatus = async (recordIds: string[], newStatus: 'borrowing' | 'returned'): Promise<void> => {
    if (recordIds.length === 0) return;
    
    const { data: records } = await supabase.from('records').select('item_id').in('record_id', recordIds);
    const itemIds = records?.map((r: any) => r.item_id) || [];

    const updates: any = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === 'returned') {
        updates.returned_at = new Date().toISOString();
        updates.return_request_date = null;
    } else {
        updates.returned_at = null;
        updates.return_request_date = null;
    }

    await supabase.from('records').update(updates).in('record_id', recordIds);
    await supabase.from('items').update({ 
        item_status: newStatus === 'returned' ? 'available' : 'borrowing' 
    }).in('item_id', itemIds);
    
    notify();
};

export const adminDeleteRecords = async (recordIds: string[]) => {
    // If deleting active records, free items
    const { data: records } = await supabase.from('records').select('item_id, status').in('record_id', recordIds);
    
    if (records) {
        const itemsToFree = records
            .filter((r: any) => r.status === 'borrowing' || r.status === 'pendingReturn')
            .map((r: any) => r.item_id);
        
        if (itemsToFree.length > 0) {
            await supabase.from('items').update({ item_status: 'available' }).in('item_id', itemsToFree);
        }
    }

    await supabase.from('records').delete().in('record_id', recordIds);
    notify();
};

// --- ADMIN NOTIFICATIONS ---

export const getAdminNotifications = async (): Promise<AdminNotification[]> => {
    try {
        const { data, error } = await supabase.from('admin_notifications').select('*').order('created_at', { ascending: false });
        if (error) {
            // Handle Network Error
            if (error.message?.includes('Failed to fetch')) {
                 console.warn('Network Error: Unable to fetch notifications (Network/CORS/Paused Project).');
                 return [];
            }
            
            // Silently ignore table missing error to avoid console noise if script partial failed
            if (error.code === 'PGRST205' || error.message.includes('admin_notifications')) {
                return [];
            }
            console.warn('Notification fetch failed:', error.message);
            return [];
        }
        return data.map(mapNotification);
    } catch (err) {
        return [];
    }
};

export const addAdminNotification = async (notif: AdminNotification) => {
    try {
        // Deduplication check
        const { data: existing } = await supabase.from('admin_notifications')
            .select('id')
            .eq('type', notif.type)
            .eq('borrow_id', notif.borrowId)
            .maybeSingle();
            
        if (existing) return;

        const { error } = await supabase.from('admin_notifications').insert([{
            id: notif.id,
            admin_id: notif.adminId,
            borrow_id: notif.borrowId,
            type: notif.type,
            title: notif.title,
            message: notif.message,
            is_read: notif.isRead,
            created_at: notif.createdAt
        }]);

        if (error) {
             // Handle Network Error
            if (error.message?.includes('Failed to fetch')) {
                 console.warn('Network Error: Failed to add notification.');
                 return;
            }
            // Handle table missing
             if (error.code === '42P01' || error.code === 'PGRST205') {
                 console.warn('Admin Notification Table missing. Please run setup SQL.');
                 return;
            }
            console.warn('Add notification error:', error.message);
        }
    } catch (e) {
        console.warn('Add notification failed');
    }
};

export const markAdminNotificationRead = async (notificationId: string) => {
    await supabase.from('admin_notifications').update({ is_read: true }).eq('id', notificationId);
};

export const markAllAdminNotificationsRead = async () => {
    await supabase.from('admin_notifications').update({ is_read: true }).eq('is_read', false);
};

export const clearAllAdminNotifications = async () => {
    await supabase.from('admin_notifications').delete().neq('id', '0');
};

// --- SCHEDULED JOBS (Simulated) ---

export const checkAndNotifyDueSoon = async () => {
    try {
        // Client-side simulation on app load:
        const { data: records, error } = await supabase.from('records').select('*').eq('status', 'borrowing');
        
        if (error || !records) return;

        const now = Date.now();
        const msInDay = 24 * 60 * 60 * 1000;

        for (const record of records) {
            if (record.due_soon_notified_at) continue;

            const borrowedAt = new Date(record.borrowed_at).getTime();
            const dueDate = borrowedAt + (record.days_borrowed * msInDay);
            const diffMs = dueDate - now;
            const daysLeft = Math.ceil(diffMs / msInDay);

            if (daysLeft === 1 && diffMs > 0) {
                 await supabase.from('records').update({ due_soon_notified_at: new Date().toISOString() }).eq('record_id', record.record_id);
                 
                 await addAdminNotification({
                    id: `due-soon-${record.record_id}`,
                    adminId: null,
                    borrowId: record.record_id,
                    type: "BORROW_DUE_SOON",
                    title: 'Due Soon',
                    message: `รายการยืมใกล้ครบกำหนดคืน`,
                    isRead: false,
                    createdAt: new Date().toISOString()
                });
            }
        }
    } catch (e) {
        console.warn('Scheduled job skipped');
    }
};

export const shouldShowDueNotification = (borrowedAt: string, daysBorrowed: number, status: string): boolean => {
    if (status === 'returned') return false;

    const borrowed = new Date(borrowedAt).getTime();
    const durationMs = daysBorrowed * 24 * 60 * 60 * 1000;
    const dueDate = borrowed + durationMs;
    const now = Date.now();
    
    const diffMs = dueDate - now;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    return diffDays <= 3;
};