-- Create the user_notification_tokens table
CREATE TABLE IF NOT EXISTS user_notification_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, token)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_notification_tokens_user_id ON user_notification_tokens(user_id);

-- Set up Row Level Security (RLS)
ALTER TABLE user_notification_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own notification tokens"
  ON user_notification_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification tokens"
  ON user_notification_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification tokens"
  ON user_notification_tokens FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notification tokens"
  ON user_notification_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_notification_tokens_updated_at
  BEFORE UPDATE ON user_notification_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column(); 