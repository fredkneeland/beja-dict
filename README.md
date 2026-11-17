# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).  This app is suppose to be a dictionary that supports fuzzy searches in the Beja language.

Search includes the Vanhove & Hamid Ahmed 2026 dictionary alongside the existing sources. Its entries show their source page, can be copied, and open the corresponding PDF page.

The script button switches displayed Beja results between Latin (the default) and Arabic script using the Wedekind pedagogical convention. Bidhaawyeet searches still use Latin input, and copied source text remains unchanged.

Use the A/a button to toggle larger search controls and results. The standard size is the default.

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Deploy (GitHub Pages)

This repo includes a GitHub Actions workflow that exports the web build and deploys it to GitHub Pages.

1. In your GitHub repo settings, go to **Pages** and set **Build and deployment** → **Source** to **GitHub Actions**.
2. Push to the `main` branch.
3. The workflow in `.github/workflows/deploy-pages.yml` will publish the site at `https://<user>.github.io/<repo>/`.

Local sanity-check (simulates hosting under `/<repo>/`):

```bash
EXPO_BASE_URL=<repo> npm run export:web
GH_PAGES_BASE_PATH=<repo> npm run postprocess:gh-pages
```

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
