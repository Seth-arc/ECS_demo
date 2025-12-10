// Firebase Configuration and Utilities
// This file can be imported by all HTML files in the project

// Firebase configuration
export const firebaseConfig = {
    apiKey: "AIzaSyDkOu9oAfVT8pqyshAWlgczyu_6qO9kIQw",
    authDomain: "ecs-demo-new.firebaseapp.com",
    projectId: "ecs-demo-new",
    storageBucket: "ecs-demo-new.firebasestorage.app",
    messagingSenderId: "305775922970",
    appId: "1:305775922970:web:823e97af5b978ce20ba6a3"
};

// Initialize Firebase (call this once per page)
export async function initializeFirebase() {
    // Import Firebase modules
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js");
    const { getAnalytics } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-analytics.js");
    const { getFirestore } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js");
    const { getAuth, signInAnonymously, onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js");

    try {
        // Initialize Firebase
        const app = initializeApp(firebaseConfig);
        const analytics = getAnalytics(app);
        const db = getFirestore(app);
        const auth = getAuth(app);

        // Sign in anonymously
        await signInAnonymously(auth);
        console.log('Firebase initialized and signed in anonymously');
        return { app, db, auth, analytics };
    } catch (error) {
        // Firebase not available, using localStorage only
        return null; // Indicate Firebase is not available
    }
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