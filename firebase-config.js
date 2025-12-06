// Firebase Configuration and Utilities
// This file can be imported by all HTML files in the project

// Firebase configuration
export const firebaseConfig = {
    apiKey: "AIzaSyDTo8YobgA6GdUskcTkJJ76v9Jig68kLqU",
    authDomain: "ecs-demo-f4723.firebaseapp.com",
    projectId: "ecs-demo-f4723",
    storageBucket: "ecs-demo-f4723.firebasestorage.app",
    messagingSenderId: "488839485022",
    appId: "1:488839485022:web:1e9c4fe46635f2c25086cf",
    measurementId: "G-NY7T3M96HC"
};

// Initialize Firebase (call this once per page)
export async function initializeFirebase() {
    // Import Firebase modules
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js");
    const { getAnalytics } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-analytics.js");
    const { getFirestore } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js");
    const { getAuth, signInAnonymously, onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js");

    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const analytics = getAnalytics(app);
    const db = getFirestore(app);
    const auth = getAuth(app);

    // Sign in anonymously
    try {
        await signInAnonymously(auth);
        console.log('Firebase initialized and signed in anonymously');
    } catch (error) {
        console.error('Anonymous sign-in failed:', error);
    }

    return { app, db, auth, analytics };
}

// Utility functions for data persistence
export async function saveToFirebase(db, collectionName, docId, data) {
    const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js");

    try {
        await setDoc(doc(db, collectionName, docId), {
            ...data,
            userId: window.currentUserId || 'anonymous',
            timestamp: new Date().toISOString()
        });
        console.log('Data saved to Firebase:', collectionName, docId);
        return true;
    } catch (error) {
        console.error('Error saving to Firebase:', error);
        // Fallback to localStorage
        localStorage.setItem(`${collectionName}_${docId}`, JSON.stringify(data));
        return false;
    }
}

export async function loadFromFirebase(db, collectionName, docId) {
    const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js");

    try {
        const docRef = doc(db, collectionName, docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            console.log('Data loaded from Firebase:', collectionName, docId);
            return docSnap.data();
        } else {
            console.log('No data found in Firebase, checking localStorage');
            // Fallback to localStorage
            const localData = localStorage.getItem(`${collectionName}_${docId}`);
            return localData ? JSON.parse(localData) : null;
        }
    } catch (error) {
        console.error('Error loading from Firebase:', error);
        // Fallback to localStorage
        const localData = localStorage.getItem(`${collectionName}_${docId}`);
        return localData ? JSON.parse(localData) : null;
    }
}

export async function addToFirebaseCollection(db, collectionName, data) {
    const { collection, addDoc } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js");

    try {
        const docRef = await addDoc(collection(db, collectionName), {
            ...data,
            userId: window.currentUserId || 'anonymous',
            timestamp: new Date().toISOString()
        });
        console.log('Document added to Firebase collection:', collectionName);
        return docRef.id;
    } catch (error) {
        console.error('Error adding to Firebase collection:', error);
        return null;
    }
}

export async function queryFirebaseCollection(db, collectionName, conditions = []) {
    const { collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js");

    try {
        let q = collection(db, collectionName);

        if (conditions.length > 0) {
            const whereConditions = conditions.map(condition =>
                where(condition.field, condition.operator, condition.value)
            );
            q = query(q, ...whereConditions);
        }

        const querySnapshot = await getDocs(q);
        const results = [];
        querySnapshot.forEach((doc) => {
            results.push({ id: doc.id, ...doc.data() });
        });

        return results;
    } catch (error) {
        console.error('Error querying Firebase collection:', error);
        return [];
    }
}