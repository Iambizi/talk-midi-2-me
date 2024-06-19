import React from 'react';
import { ChatAiWidget } from '@sendbird/chat-ai-widget';

interface ChatComponentProps {
  appId: string;
  botId: string;
}

const ChatComponent: React.FC<ChatComponentProps> = () => {
  const appId = process.env.REACT_APP_SENDBIRD_APP_ID;
  const botId = process.env.REACT_APP_SENDBIRD_BOT_ID;

  return (
    <ChatAiWidget
      appId={appId}
      botId={botId}
    />
  );
};

export default ChatComponent;