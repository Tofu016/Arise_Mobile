import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

// Read-only node feed for the public MainPage (no CRUD needed there, unlike
// useNodes which the admin editor uses). Subscribes live to the same "nodes"
// collection the admin editor writes to, so visitors see edits as they
// happen — no redeploy or re-export step required.
export function usePublicNodes() {
  const [nodes, setNodes] = useState(null); // null while loading
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "nodes"),
      (snapshot) => setNodes(snapshot.docs.map((d) => d.data())),
      (err) => setError(err.message)
    );
    return unsubscribe;
  }, []);

  return { nodes, error };
}
