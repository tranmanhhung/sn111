# The MIT License (MIT)
# Copyright © 2023 Yuma Rao
# Copyright © 2024 oneoneone

# Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
# documentation files (the "Software"), to deal in the Software without restriction, including without limitation
# the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software,
# and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

# The above copyright notice and this permission notice shall be included in all copies or substantial portions of
# the Software.

# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO
# THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
# THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
# OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
# DEALINGS IN THE SOFTWARE.

import time
import bittensor as bt

# Import base validator class
from oneoneone.base.validator import BaseValidatorNeuron

# Import forward function
from oneoneone.validator import forward


class Validator(BaseValidatorNeuron):
    """
    Validator neuron for the oneoneone subnet.
    This validator queries miners for Google Maps reviews data and scores their responses.
    """

    def __init__(self, config=None):
        super(Validator, self).__init__(config=config)
        bt.logging.info(f"Validator initialized with netuid: {self.config.netuid}")

        bt.logging.info("Loading validator state...")
        self.load_state()

    async def forward(self):
        """
        Validator forward pass. Consists of:
        - Generating the query
        - Querying the miners
        - Getting the responses
        - Rewarding the miners
        - Updating the scores
        """
        return await forward(self)


# Main execution
if __name__ == "__main__":
    bt.logging.info("Starting oneoneone validator...")
    with Validator() as validator:
        bt.logging.success(f"Validator started successfully on uid: {validator.uid}")
        while True:
            bt.logging.info(f"Validator running... {time.time()}")
            time.sleep(30)  # Reduced frequency for cleaner logs
