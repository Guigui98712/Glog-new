import { initializeApp } from "firebase/app";
import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyBtWY3vKr-6APG5aIiHs1CH2sOcx958Zv4",
  authDomain: "glog-a2338.firebaseapp.com",
  projectId: "glog-a2338",
  storageBucket: "glog-a2338.firebasestorage.app",
  messagingSenderId: "19946419586",
  appId: "1:19946419586:android:02c53f53d523dbcb0acb9b"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export { messaging }; 