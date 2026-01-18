/*
  # Add Tournament Delete Policy
  
  1. Changes
    - Add DELETE policy for tournaments table
    - Allow tournament creator to delete tournament if not started yet
  
  2. Security
    - Only creator (created_by) can delete
    - Only if status is 'draft' or 'registration'
    - Prevents deletion of active or completed tournaments
*/

CREATE POLICY "Host can delete tournaments before they start"
  ON tournaments FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid() 
    AND status IN ('draft', 'registration')
  );
