import {
    collection,
    doc,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    getDocs,
    getDoc,
    getCountFromServer,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    serverTimestamp,
    increment,
    Timestamp,
    Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UserProfile {
    uid: string;
    displayName: string;
    email: string;
    photoURL?: string;
    createdAt: Timestamp;
    lastSeen: Timestamp;
}

export interface ChatSession {
    id: string;
    userId: string;
    title: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    messageCount: number;
}

export interface ChatMessage {
    id: string;
    sessionId: string;
    userId: string;
    role: 'user' | 'assistant';
    content: string;
    sources?: unknown[];
    metrics?: unknown;
    createdAt: Timestamp;
}

export interface Project {
    id: string;
    userId: string;
    name: string;
    description: string;
    status: 'active' | 'on-hold' | 'completed' | 'archived';
    priority: 'low' | 'medium' | 'high';
    color: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface Task {
    id: string;
    projectId: string;
    userId: string;
    title: string;
    description?: string;
    status: 'todo' | 'in-progress' | 'done';
    priority: 'low' | 'medium' | 'high';
    dueDate?: Timestamp;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// ── User Profile ─────────────────────────────────────────────────────────────

export async function upsertUserProfile(uid: string, data: Partial<UserProfile>) {
    // Strip undefined values — Firestore rejects them.
    const clean = Object.fromEntries(
        Object.entries({ uid, lastSeen: serverTimestamp(), ...data }).filter(([, v]) => v !== undefined)
    );
    await setDoc(doc(db, 'users', uid), clean, { merge: true });
}

// ── Chat Sessions ─────────────────────────────────────────────────────────────

export async function createChatSession(userId: string, title = 'New Chat'): Promise<string> {
    const ref = await addDoc(collection(db, 'chatSessions'), {
        userId,
        title,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        messageCount: 0,
    });
    return ref.id;
}

export async function updateSessionTitle(sessionId: string, title: string) {
    await updateDoc(doc(db, 'chatSessions', sessionId), {
        title,
        updatedAt: serverTimestamp(),
    });
}

export async function deleteSession(sessionId: string, userId: string) {
    // Delete all messages first — must include userId so Firestore security rules
    // can verify ownership (rules require request.auth.uid == resource.data.userId).
    const q = query(
        collection(db, 'chatMessages'),
        where('sessionId', '==', sessionId),
        where('userId', '==', userId)
    );
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    await deleteDoc(doc(db, 'chatSessions', sessionId));
}

export function subscribeToSessions(
    userId: string,
    cb: (sessions: ChatSession[]) => void
): Unsubscribe {
    const q = query(
        collection(db, 'chatSessions'),
        where('userId', '==', userId),
        orderBy('updatedAt', 'desc'),
        limit(50)
    );
    return onSnapshot(
        q,
        (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatSession))),
        (err) => {
            if (err.code === 'failed-precondition') {
                console.warn('[Firestore] chatSessions index is still building — will retry automatically once ready.');
            } else {
                console.error('[Firestore] subscribeToSessions error:', err.message);
            }
            cb([]);
        }
    );
}

// ── Chat Messages ─────────────────────────────────────────────────────────────

export async function addMessage(
    sessionId: string,
    userId: string,
    role: 'user' | 'assistant',
    content: string,
    sources?: unknown[],
    metrics?: unknown
): Promise<string> {
    // Write message and increment counter concurrently — no sequential getDoc needed.
    const [ref] = await Promise.all([
        addDoc(collection(db, 'chatMessages'), {
            sessionId,
            userId,
            role,
            content,
            sources: sources ?? [],
            metrics: metrics ?? null,
            createdAt: serverTimestamp(),
        }),
        updateDoc(doc(db, 'chatSessions', sessionId), {
            messageCount: increment(1), // atomic server-side increment
            updatedAt: serverTimestamp(),
        }),
    ]);
    return ref.id;
}

export function subscribeToMessages(
    sessionId: string,
    userId: string,
    cb: (messages: ChatMessage[]) => void
): Unsubscribe {
    const q = query(
        collection(db, 'chatMessages'),
        where('sessionId', '==', sessionId),
        where('userId', '==', userId),
        orderBy('createdAt', 'asc')
    );
    return onSnapshot(
        q,
        (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatMessage))),
        (err) => {
            if (err.code === 'failed-precondition') {
                console.warn('[Firestore] chatMessages index is still building — will retry automatically once ready.');
            } else {
                console.error('[Firestore] subscribeToMessages error:', err.message);
            }
            cb([]);
        }
    );
}

// ── Projects ──────────────────────────────────────────────────────────────────

export async function createProject(
    userId: string,
    data: { name: string; description: string; status: Project['status']; priority: Project['priority']; color: string }
): Promise<string> {
    const ref = await addDoc(collection(db, 'projects'), {
        ...data,
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return ref.id;
}

export async function updateProject(projectId: string, data: Partial<Project>) {
    await updateDoc(doc(db, 'projects', projectId), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteProject(projectId: string) {
    // Delete tasks too
    const q = query(collection(db, 'tasks'), where('projectId', '==', projectId));
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    await deleteDoc(doc(db, 'projects', projectId));
}

export function subscribeToProjects(userId: string, cb: (projects: Project[]) => void): Unsubscribe {
    const q = query(
        collection(db, 'projects'),
        where('userId', '==', userId),
        orderBy('updatedAt', 'desc')
    );
    return onSnapshot(
        q,
        (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project))),
        (err) => {
            if (err.code === 'failed-precondition') {
                console.warn('[Firestore] projects index is still building — will retry automatically once ready.');
            } else {
                console.error('[Firestore] subscribeToProjects error:', err.message);
            }
            cb([]);
        }
    );
}

// ── Tasks ──────────────────────────────────────────────────────────────────────

export async function createTask(
    projectId: string,
    userId: string,
    data: { title: string; description?: string; status: Task['status']; priority: Task['priority'] }
): Promise<string> {
    const ref = await addDoc(collection(db, 'tasks'), {
        ...data,
        projectId,
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return ref.id;
}

export async function updateTask(taskId: string, data: Partial<Task>) {
    await updateDoc(doc(db, 'tasks', taskId), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteTask(taskId: string) {
    await deleteDoc(doc(db, 'tasks', taskId));
}

export function subscribeToTasks(projectId: string, cb: (tasks: Task[]) => void): Unsubscribe {
    const q = query(
        collection(db, 'tasks'),
        where('projectId', '==', projectId),
        orderBy('createdAt', 'asc')
    );
    return onSnapshot(
        q,
        (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task))),
        (err) => {
            if (err.code === 'failed-precondition') {
                console.warn('[Firestore] tasks index is still building — will retry automatically once ready.');
            } else {
                console.error('[Firestore] subscribeToTasks error:', err.message);
            }
            cb([]);
        }
    );
}

export async function getProjectTaskCounts(
    projectId: string
): Promise<{ total: number; done: number }> {
    // Use getCountFromServer — returns only counts, not full documents.
    const [totalSnap, doneSnap] = await Promise.all([
        getCountFromServer(query(collection(db, 'tasks'), where('projectId', '==', projectId))),
        getCountFromServer(query(collection(db, 'tasks'), where('projectId', '==', projectId), where('status', '==', 'done'))),
    ]);
    return { total: totalSnap.data().count, done: doneSnap.data().count };
}
