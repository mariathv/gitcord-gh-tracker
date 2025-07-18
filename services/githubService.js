import { Octokit } from "@octokit/rest";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export async function getUserStats(username) {
  const { data } = await octokit.rest.users.getByUsername({ username });
  return {
    followers: data.followers,
    publicRepos: data.public_repos,
    createdAt: data.created_at,
  };
}
