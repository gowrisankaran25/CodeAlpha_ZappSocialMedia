# ⚡ Zapp —  Social Media App



A full-stack social media application built with **Express.js**, **MongoDB**, and vanilla **HTML/CSS/JS**.

---

## 🗂 Project Structure
socialmedia/
├── backend/
│   ├── models/
│   │   ├── User.js        # User schema (auth, followers, profile)
│   │   ├── Post.js        # Post schema (content, likes)
│   │   ├── Comment.js     # Comment schema (nested likes)
│   │   └── Follower.js    # Follow relationship schema
│   ├── routes/
│   │   ├── auth.js        # Register, Login, /me
│   │   ├── users.js       # Profiles, follow/unfollow, search
│   │   └── posts.js       # CRUD posts, likes, comments
│   ├── middleware/
│   │   └── auth.js        # JWT middleware
│   ├── server.js          # Express app entry point
│   ├── package.json
│   └── .env.example       # Copy to .env and fill in values
└── frontend/
    ├── index.html
    ├── css/style.css
    └── js/
        ├── api.js         # API helper (fetch wrapper)
        └── app.js         # Full UI logic


The project is organized into `backend/` and `frontend/` directories with the following structure:

* **Backend Models**: Includes `User.js` (handling auth, followers, and profiles), `Post.js` (handling content and likes), `Comment.js` (handling nested likes), and `Follower.js` (handling follow relationship schemas).


* **Backend Routes**: Contains `auth.js` for registration, login, and `/me`; `users.js` for profiles, follow/unfollow actions, and search; and `posts.js` for CRUD operations on posts, likes, and comments.


* **Backend Middleware & Entry**: Uses `auth.js` for JWT middleware and `server.js` as the Express application's entry point.


* **Frontend**: Consists of `index.html`, `css/style.css`, and a `js/` folder containing `api.js` (a fetch wrapper API helper) and `app.js` (handling full UI logic).



---

## 🚀 Setup & Run



### 1. Install MongoDB



* Ensure MongoDB is running locally (e.g., using `brew services start mongodb-community` on macOS or `sudo systemctl start mongod` on Ubuntu).


* Alternatively, you can use MongoDB Atlas in the cloud and update the `MONGO_URI` in your `.env` file.



### 2. Install Backend Dependencies



* Navigate to the backend directory (`cd backend`) and run `npm install` to install dependencies.



### 3. Configure Environment



* Copy the `.env.example` file to `.env` (`cp .env.example .env`).


* Edit the `.env` file to include your specific `MONGO_URI`, `JWT_SECRET`, and set the `PORT` to `5000`.



### 4. Start the Server



* For development purposes with auto-reload enabled, run `npm run dev`.


* For a production environment, run `npm start`.



### 5. Open the App



* Visit **http://localhost:5000** in your web browser to view the application.



---

## ✨ Features



### 👤 User Profiles



* Users can register and log in using JWT authentication.


* Profiles feature an editable display name, bio, and avatar URL.


* Users can view their follower and following counts.


* Each username has a dedicated public profile page.



### 📝 Posts & Comments



* Users can compose posts with a maximum limit of 500 characters.


* Posts can include an optional image URL attachment.


* The Home feed displays posts specifically from followed users.


* The Explore feed displays all posts in chronological order.


* Users have the ability to delete their own posts and comments.


* Users can like or unlike comments.



### ❤️ Like / Follow System



* Users can like or unlike any post, which triggers a real-time count update.


* Users can follow or unfollow any other user.


* The interface includes a sidebar suggesting people to follow.


* Users can be searched by their username or display name.



---

## 🔌 API Reference



### Auth



| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/auth/register` | Create account

 |
| POST | `/api/auth/login` | Login, returns JWT

 |
| GET | `/api/auth/me` | Get current user

 |

### Posts



| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/posts/feed` | Followed-users feed

 |
| GET | `/api/posts/explore` | All posts

 |
| POST | `/api/posts` | Create post

 |
| DELETE | `/api/posts/:id` | Delete post

 |
| POST | `/api/posts/:id/like` | Toggle like

 |
| GET | `/api/posts/:id/comments` | List comments

 |
| POST | `/api/posts/:id/comments` | Add comment

 |
| DELETE | `/api/posts/:id/comments/:cid` | Delete comment

 |
| POST | `/api/posts/:id/comments/:cid/like` | Toggle comment like

 |

### Users



| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/users/:username` | Get profile

 |
| PUT | `/api/users/profile/update` | Update profile

 |
| GET | `/api/users/:username/posts` | User's posts

 |
| POST | `/api/users/:id/follow` | Follow user

 |
| DELETE | `/api/users/:id/follow` | Unfollow user

 |
| GET | `/api/users/search?q=` | Search users

 |
| GET | `/api/users/suggestions/people` | Follow suggestions

 |

---

## 🗄 Database Models



* **User**: Schema includes `username`, `email`, `password (hashed)`, `displayName`, `bio`, `avatar`, `followers[]`, `following[]`, `postsCount`, and `timestamps`.


* **Post**: Schema includes `author (ref User)`, `content`, `image`, `likes[]`, `likesCount`, `commentsCount`, `tags[]`, and `timestamps`.


* **Comment**: Schema includes `post (ref Post)`, `author (ref User)`, `content`, `likes[]`, `likesCount`, `parentComment`, and `timestamps`.


* **Follower**: Schema includes `follower (ref User)`, `following (ref User)`, and `timestamps`, and utilizes a unique index for `{ follower, following }`.



---

## 🛡 Security Notes



* All passwords are bcrypt-hashed utilizing 12 salt rounds.


* JWT tokens are configured to expire in 7 days.


* Authentication middleware is implemented to protect all write routes.


* Input sanitization is enforced through Mongoose schema constraints.


* > **Important Note:** Always remember to change the `JWT_SECRET` in a production environment!
> 
>