import { useParams, useSearchParams } from "react-router-dom";
import { useEffect } from "react";

export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const { channel } = useParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const bc = new BroadcastChannel(`oauth_${channel}`);
    bc.postMessage({code});
    window.close();
  }, [channel, searchParams])

  return (
    <div/>
  );
}
