import { useSearchParams } from "react-router-dom";
import { useEffect } from "react";

export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const bc = new BroadcastChannel('oauth_jaccount');
    bc.postMessage({code});
    window.close();
  }, [searchParams])

  return (
    <div/>
  );
}
