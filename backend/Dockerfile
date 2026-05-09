FROM node:20-alpine

WORKDIR /app

# 패키지 파일 복사 및 의존성 설치
COPY package*.json ./
RUN npm install

# 소스 코드 복사
COPY . .

# 컨테이너 실행 시 사용할 명령어
CMD ["npm", "start"]
