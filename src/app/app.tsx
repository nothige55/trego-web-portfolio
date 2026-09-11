// 인증 provider를 라우터 바깥에 두어 모든 route가 같은 로그인 세션과 API client를 공유하게 함

import { RouterProvider } from "react-router/dom";

import { AuthProvider } from "@/app/auth/auth-provider";
import { router } from "@/app/router";

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

export default App;
