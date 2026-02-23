import { Mastra } from '@mastra/core';
import { dependencyAgent } from "./agents/dependency-agent";

export const mastra = new Mastra({
    agents: {
        dependencyAgent,
    },
});
        