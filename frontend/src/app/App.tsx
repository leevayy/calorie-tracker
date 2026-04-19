import { RouterProvider } from "react-router";
import { EmojiProvider } from "react-apple-emojis";
import emojiData from "react-apple-emojis/src/data.json";
import { router } from "./routes";
import { ThemeProvider } from "./components/ThemeProvider";

export default function App() {
  return (
    <ThemeProvider>
      <EmojiProvider data={emojiData}>
        <RouterProvider router={router} />
      </EmojiProvider>
    </ThemeProvider>
  );
}