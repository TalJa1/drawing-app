import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from './AppShell'
import { MainLayout } from './MainLayout'
import { StudioLayout } from './StudioLayout'
import { LazyPage as P } from './LazyPage'
import { RouteError } from './RouteError'

export const router = createBrowserRouter(
  [
    {
      element: <AppShell />,
      errorElement: <RouteError />,
      children: [
        {
          element: <MainLayout />,
          children: [
            { index: true, element: <P page="home" /> },
            { path: 'practice', element: <P page="practice" /> },
            { path: 'practice/result/:artworkId', element: <P page="practiceResult" /> },
            { path: 'learn', element: <P page="learn" /> },
            { path: 'learn/art-forms/:slug', element: <P page="artForm" /> },
            { path: 'learn/movements/:slug', element: <P page="movement" /> },
            { path: 'learn/artists/:slug', element: <P page="artist" /> },
            { path: 'learn/lessons/:slug', element: <P page="lesson" /> },
            { path: 'learn/color-lab', element: <P page="colorLab" /> },
            { path: 'learn/glossary', element: <P page="glossary" /> },
            { path: 'learn/flashcards', element: <P page="flashcards" /> },
            { path: 'learn/spot-the-style', element: <P page="spotStyle" /> },
            { path: 'chat', element: <P page="chat" /> },
            { path: 'collection', element: <P page="collection" /> },
            { path: 'achievements', element: <P page="achievements" /> },
            { path: 'profile', element: <P page="profile" /> },
            { path: 'login', element: <P page="login" /> },
            { path: 'register', element: <P page="register" /> },
            { path: 'styleguide', element: <P page="styleguide" /> },
            { path: '*', element: <P page="notFound" /> },
          ],
        },
        {
          element: <StudioLayout />,
          children: [
            { path: 'practice/:templateId', element: <P page="practiceStudio" /> },
            { path: 'free-draw', element: <P page="freeDraw" /> },
          ],
        },
      ],
    },
  ],
  {
    future: {
      v7_relativeSplatPath: true,
      v7_fetcherPersist: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: true,
      v7_skipActionErrorRevalidation: true,
    },
  },
)
