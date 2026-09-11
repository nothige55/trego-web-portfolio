// 홈 화면이 app 라우트와 주고받는 여행 요약·생성 입력 타입
// 서버 프로젝트 응답을 HomeTripSummary로 옮기는 일은 app/routes/root-route가 맡음

export type HomeTripSummary = {
  id: string;
  title: string;
  description?: string;
  dateLabel?: string;
};

export type CreateTripInput = {
  title: string;
  startDate: string;
  endDate: string;
};
