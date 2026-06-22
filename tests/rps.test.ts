import { rpsEngine } from '../src/lib/games/rps';

describe('RPS Game Engine', () => {
  it('should create initial state', () => {
    const state = rpsEngine.getInitialState();
    expect(state.round).toBe(1);
    expect(state.p1Score).toBe(0);
    expect(state.p2Score).toBe(0);
  });

  it('should properly score Rock vs Scissors', () => {
    const { nextState } = rpsEngine.computeNextState({ round: 1, p1Score: 0, p2Score: 0 }, 'R', 'S');
    expect(nextState.p1Score).toBe(1);
    expect(nextState.p2Score).toBe(0);
    expect(nextState.round).toBe(2);
  });

  it('should properly score Paper vs Rock', () => {
    const { nextState } = rpsEngine.computeNextState({ round: 1, p1Score: 0, p2Score: 0 }, 'P', 'R');
    expect(nextState.p1Score).toBe(1);
    expect(nextState.p2Score).toBe(0);
  });

  it('should properly score Scissors vs Paper', () => {
    const { nextState } = rpsEngine.computeNextState({ round: 1, p1Score: 0, p2Score: 0 }, 'S', 'P');
    expect(nextState.p1Score).toBe(1);
    expect(nextState.p2Score).toBe(0);
  });

  it('should properly handle draws', () => {
    const { nextState, winner } = rpsEngine.computeNextState({ round: 1, p1Score: 0, p2Score: 0 }, 'R', 'R');
    expect(nextState.p1Score).toBe(0);
    expect(nextState.p2Score).toBe(0);
    expect(nextState.round).toBe(2);
    expect(winner).toBeNull();
  });

  it('should declare a winner when max turns reached or score is 2', () => {
    const { winner } = rpsEngine.computeNextState({ round: 3, p1Score: 1, p2Score: 0 }, 'R', 'S');
    expect(winner).toBe('p1');
  });

});
